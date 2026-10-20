import { Router } from 'express';
import { z } from 'zod';

import { APP_NAME, isOpenAt } from '../../../shared';
import { requireActiveUser, requireUser } from '../auth';
import { one, q } from '../db';
import { HttpError, notFound, parse } from '../http';
import { mediaUrl } from '../media';
import { config } from '../config';
import { newShareSlug } from './auth';

export const listRoutes = Router();
export const sharedListRoutes = Router();
export const sharePageRoutes = Router();

function shareUrl(slug: string) {
  return `${config.shareBaseUrl}/l/${slug}`;
}

function serializeList(l: any) {
  return {
    id: l.id,
    kind: l.kind,
    name: l.name,
    isShared: l.is_shared,
    shareUrl: l.is_shared ? shareUrl(l.share_slug) : null,
    placeCount: l.place_count ?? 0,
    coverUrl: mediaUrl(l.cover_key),
    createdAt: l.created_at,
  };
}

const LIST_SELECT = `SELECT l.*,
  (SELECT count(*)::int FROM list_items li WHERE li.list_id = l.id) AS place_count,
  (SELECT ph.storage_key FROM list_items li JOIN photos ph ON ph.place_id = li.place_id AND ph.hidden_at IS NULL
     JOIN visible_reviews vr ON vr.id = ph.review_id
     WHERE li.list_id = l.id ORDER BY li.added_at DESC, ph.id DESC LIMIT 1) AS cover_key
  FROM lists l`;

async function listItems(listId: number) {
  const rows = await q(
    `SELECT li.note, li.added_at, p.id, p.name, p.category, p.city, p.neighbourhood, p.lat, p.lng,
            p.opening_hours, p.timezone, s.paws, s.review_count, s.price_bracket,
            (SELECT ph.storage_key FROM photos ph JOIN visible_reviews vr ON vr.id = ph.review_id
              WHERE ph.place_id = p.id AND ph.hidden_at IS NULL ORDER BY ph.id DESC LIMIT 1) AS cover_key
     FROM list_items li JOIN places p ON p.id = li.place_id LEFT JOIN place_stats s ON s.place_id = p.id
     WHERE li.list_id = $1 AND p.hidden_at IS NULL ORDER BY li.added_at DESC`,
    [listId],
  );
  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    city: r.city,
    neighbourhood: r.neighbourhood,
    lat: r.lat,
    lng: r.lng,
    paws: r.paws,
    reviewCount: r.review_count ?? 0,
    priceBracket: r.price_bracket,
    coverUrl: mediaUrl(r.cover_key),
    openNow: isOpenAt(r.opening_hours, now, r.timezone),
    note: r.note,
    addedAt: r.added_at,
  }));
}

async function ownList(userId: number, id: number) {
  const l = await one(`${LIST_SELECT} WHERE l.id = $1 AND l.user_id = $2`, [id, userId]);
  if (!l) throw notFound();
  return l;
}

listRoutes.get('/', async (req, res) => {
  const me = requireUser(req);
  const rows = await q(`${LIST_SELECT} WHERE l.user_id = $1 ORDER BY (l.kind = 'custom'), l.kind, l.id`, [me.id]);
  res.json({ lists: rows.map(serializeList) });
});

listRoutes.post('/', async (req, res) => {
  const me = requireActiveUser(req);
  const { name } = parse(z.object({ name: z.string().trim().min(1).max(60) }), req.body);
  const count = await one<{ n: number }>('SELECT count(*)::int AS n FROM lists WHERE user_id = $1', [me.id]);
  if (count!.n >= 100) throw new HttpError(429, 'too_many_lists');
  const l = await one(
    'INSERT INTO lists (user_id, kind, name, share_slug) VALUES ($1, $2, $3, $4) RETURNING id',
    [me.id, 'custom', name, newShareSlug()],
  );
  res.status(201).json(serializeList(await ownList(me.id, l!.id)));
});

listRoutes.get('/:id', async (req, res) => {
  const me = requireUser(req);
  const l = await ownList(me.id, Number(req.params.id));
  res.json({ ...serializeList(l), places: await listItems(l.id) });
});

listRoutes.patch('/:id', async (req, res) => {
  const me = requireUser(req);
  const l = await ownList(me.id, Number(req.params.id));
  const b = parse(z.object({ name: z.string().trim().min(1).max(60).optional(), isShared: z.boolean().optional() }), req.body);
  if (b.name && l.kind !== 'custom') throw new HttpError(400, 'cannot_rename_list');
  await q('UPDATE lists SET name = COALESCE($2, name), is_shared = COALESCE($3, is_shared) WHERE id = $1', [l.id, b.name, b.isShared]);
  res.json(serializeList(await ownList(me.id, l.id)));
});

listRoutes.delete('/:id', async (req, res) => {
  const me = requireUser(req);
  const l = await ownList(me.id, Number(req.params.id));
  if (l.kind !== 'custom') throw new HttpError(400, 'cannot_delete_list');
  await q('DELETE FROM lists WHERE id = $1', [l.id]);
  res.json({ ok: true });
});

listRoutes.post('/:id/places', async (req, res) => {
  const me = requireActiveUser(req);
  const l = await ownList(me.id, Number(req.params.id));
  const b = parse(z.object({ placeId: z.number().int().positive(), note: z.string().trim().max(200).default('') }), req.body);
  const place = await one('SELECT id FROM places WHERE id = $1 AND hidden_at IS NULL', [b.placeId]);
  if (!place) throw notFound();
  if (l.place_count >= 500) throw new HttpError(429, 'list_full');
  await q(
    'INSERT INTO list_items (list_id, place_id, note) VALUES ($1, $2, $3) ON CONFLICT (list_id, place_id) DO UPDATE SET note = EXCLUDED.note',
    [l.id, b.placeId, b.note],
  );
  res.status(201).json(serializeList(await ownList(me.id, l.id)));
});

listRoutes.delete('/:id/places/:placeId', async (req, res) => {
  const me = requireUser(req);
  const l = await ownList(me.id, Number(req.params.id));
  await q('DELETE FROM list_items WHERE list_id = $1 AND place_id = $2', [l.id, Number(req.params.placeId)]);
  res.json(serializeList(await ownList(me.id, l.id)));
});

/** Anyone with the link, signed in or not, once the owner has switched sharing on. */
async function sharedList(slug: string) {
  const l = await one(
    `${LIST_SELECT.replace('FROM lists l', 'FROM lists l JOIN users u ON u.id = l.user_id')}
     WHERE l.share_slug = $1 AND l.is_shared AND u.banned_at IS NULL`,
    [slug],
  );
  if (!l) throw notFound();
  const owner = await one('SELECT id, display_name FROM users WHERE id = $1', [l.user_id]);
  return { ...serializeList(l), owner: { id: owner!.id, displayName: owner!.display_name }, places: await listItems(l.id) };
}

sharedListRoutes.get('/:slug', async (req, res) => {
  res.json(await sharedList(req.params.slug));
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const LIST_NAMES: Record<string, string> = { want_to_try: 'Want to try', date_night: 'Date night' };

/** A tiny web page so a shared link works for friends who don't have the app yet. */
sharePageRoutes.get('/:slug', async (req, res) => {
  let list;
  try {
    list = await sharedList(req.params.slug);
  } catch {
    res.status(404).type('html').send(`<!doctype html><meta name="viewport" content="width=device-width">
      <body style="font-family:system-ui;padding:24px"><h1>🐶 Sniffed around…</h1><p>This list is private or gone.</p>`);
    return;
  }
  const title = list.name || LIST_NAMES[list.kind] || 'A list';
  const items = list.places
    .map((p) => `<li><b>${esc(p.name)}</b>${p.paws ? ` · ${'🐾'.repeat(Math.round(p.paws))}` : ''}<br><small>${esc(p.neighbourhood || p.city)}</small>
      ${p.note ? `<br><i>${esc(p.note)}</i>` : ''}
      <br><a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}">Map</a></li>`)
    .join('');
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${APP_NAME}</title>
<meta property="og:title" content="${esc(title)} by ${esc(list.owner.displayName)}"></head>
<body style="font-family:system-ui;max-width:640px;margin:auto;padding:24px;line-height:1.5">
<h1>${esc(title)}</h1><p>A ${APP_NAME} list by ${esc(list.owner.displayName)} · ${list.places.length} places</p>
<ul style="padding-left:18px">${items}</ul>
<p><a href="tastr://lists/shared/${esc(req.params.slug)}">Open in ${APP_NAME}</a></p></body></html>`);
});
