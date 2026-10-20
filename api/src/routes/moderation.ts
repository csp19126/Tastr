import { Router } from 'express';
import { z } from 'zod';

import { LANGUAGES, LIMITS, REPORT_REASONS, REPORT_TARGETS, type ReportTarget } from '../../../shared';
import { requireActiveUser, requireAdmin } from '../auth';
import { CONTENT_KEYS } from '../content-defaults';
import { one, q, tx, type Db } from '../db';
import { HttpError, notFound, parse } from '../http';
import { mediaUrl } from '../media';

export const reportRoutes = Router();
export const adminRoutes = Router();
export const contentRoutes = Router();

const TABLE: Record<ReportTarget, string> = {
  review: 'reviews',
  photo: 'photos',
  comment: 'comments',
  place: 'places',
  user: 'users',
};

async function targetExists(type: ReportTarget, id: number) {
  return !!(await one(`SELECT 1 FROM ${TABLE[type]} WHERE id = $1`, [id]));
}

// ---------------------------------------------------------------- reporting (any signed-in user)

reportRoutes.post('/', async (req, res) => {
  const me = requireActiveUser(req);
  const b = parse(
    z.object({
      targetType: z.enum(REPORT_TARGETS),
      targetId: z.number().int().positive(),
      reason: z.enum(REPORT_REASONS),
      details: z.string().trim().max(1000).default(''),
    }),
    req.body,
  );
  if (!(await targetExists(b.targetType, b.targetId))) throw notFound();
  const today = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM reports WHERE reporter_id = $1 AND created_at > now() - interval '1 day'`,
    [me.id],
  );
  if (today!.n >= LIMITS.reportsPerDay) throw new HttpError(429, 'too_many_reports');
  // Reporting the same thing twice is fine from the user's side; we just keep the first.
  await q(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING`,
    [me.id, b.targetType, b.targetId, b.reason, b.details],
  );
  res.status(201).json({ ok: true });
});

// ---------------------------------------------------------------- admin

async function log(db: Db, adminId: number, action: string, type: string, id: number, note = '') {
  await q('INSERT INTO moderation_log (admin_id, action, target_type, target_id, note) VALUES ($1, $2, $3, $4, $5)', [adminId, action, type, id, note], db);
}

/** A short look at what was reported, so the admin can decide without opening five screens. */
async function preview(type: ReportTarget, id: number) {
  switch (type) {
    case 'review': {
      const r = await one(
        `SELECT r.id, r.body, r.rating, r.sponsored, r.hidden_at, r.user_id, u.display_name, p.id AS place_id, p.name AS place_name
         FROM reviews r JOIN users u ON u.id = r.user_id JOIN places p ON p.id = r.place_id WHERE r.id = $1`, [id]);
      return r && { text: r.body, rating: r.rating, sponsored: r.sponsored, hidden: !!r.hidden_at, authorId: r.user_id, authorName: r.display_name, placeId: r.place_id, placeName: r.place_name };
    }
    case 'photo': {
      const p = await one(`SELECT ph.*, u.display_name FROM photos ph JOIN users u ON u.id = ph.user_id WHERE ph.id = $1`, [id]);
      return p && { url: mediaUrl(p.storage_key), hidden: !!p.hidden_at, authorId: p.user_id, authorName: p.display_name, reviewId: p.review_id };
    }
    case 'comment': {
      const c = await one(`SELECT c.*, u.display_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = $1`, [id]);
      return c && { text: c.body, hidden: !!c.hidden_at, authorId: c.user_id, authorName: c.display_name, reviewId: c.review_id };
    }
    case 'place': {
      const p = await one(`SELECT * FROM places WHERE id = $1`, [id]);
      return p && { text: `${p.name} (${p.category}) ${p.address}`, hidden: !!p.hidden_at, authorId: p.created_by, placeId: p.id, placeName: p.name };
    }
    case 'user': {
      const u = await one(`SELECT * FROM users WHERE id = $1`, [id]);
      return u && { text: `${u.display_name}: ${u.bio}`, hidden: !!u.banned_at, authorId: u.id, authorName: u.display_name };
    }
  }
}

adminRoutes.get('/reports', async (req, res) => {
  requireAdmin(req);
  const { status } = parse(z.object({ status: z.enum(['open', 'actioned', 'dismissed']).default('open') }), req.query);
  // One row per reported thing, with how many people reported it and why.
  const rows = await q(
    `SELECT target_type, target_id, count(*)::int AS report_count, array_agg(DISTINCT reason) AS reasons,
            array_agg(details ORDER BY id) FILTER (WHERE details <> '') AS details,
            min(created_at) AS first_reported_at, array_agg(id) AS report_ids
     FROM reports WHERE status = $1 GROUP BY target_type, target_id
     ORDER BY count(*) DESC, min(created_at) LIMIT 200`,
    [status],
  );
  const items = await Promise.all(
    rows.map(async (r) => ({
      targetType: r.target_type,
      targetId: r.target_id,
      reportCount: r.report_count,
      reasons: r.reasons,
      details: r.details ?? [],
      firstReportedAt: r.first_reported_at,
      reportIds: r.report_ids,
      target: (await preview(r.target_type, r.target_id)) ?? null,
    })),
  );
  res.json({ items });
});

async function setHidden(db: Db, adminId: number, type: Exclude<ReportTarget, 'user'>, id: number, hidden: boolean, note: string) {
  const extra = type === 'review' ? ', hidden_reason = $3' : '';
  const params = type === 'review' ? [id, hidden, hidden ? note : null] : [id, hidden];
  const row = await one(
    `UPDATE ${TABLE[type]} SET hidden_at = CASE WHEN $2 THEN now() ELSE NULL END${extra} WHERE id = $1 RETURNING id`,
    params,
    db,
  );
  if (!row) throw notFound();
  await log(db, adminId, hidden ? 'hide' : 'unhide', type, id, note);
}

async function setBanned(db: Db, adminId: number, userId: number, banned: boolean, reason: string) {
  const row = await one(
    `UPDATE users SET banned_at = CASE WHEN $2 THEN now() ELSE NULL END, ban_reason = $3 WHERE id = $1 AND role <> 'admin' RETURNING id`,
    [userId, banned, banned ? reason : null],
    db,
  );
  if (!row) throw new HttpError(404, 'not_found', 'No such user (admins cannot be banned here)');
  // A banned account is signed out everywhere. Their reviews drop out of every average automatically.
  if (banned) await q('DELETE FROM sessions WHERE user_id = $1', [userId], db);
  await log(db, adminId, banned ? 'ban' : 'unban', 'user', userId, reason);
}

/** Resolve every open report about one thing: hide it (and optionally ban its author), or dismiss. */
adminRoutes.post('/reports/resolve', async (req, res) => {
  const admin = requireAdmin(req);
  const b = parse(
    z.object({
      targetType: z.enum(REPORT_TARGETS),
      targetId: z.number().int().positive(),
      action: z.enum(['hide', 'dismiss']),
      banAuthor: z.boolean().default(false),
      note: z.string().trim().max(500).default(''),
    }),
    req.body,
  );
  await tx(async (db) => {
    if (b.action === 'hide') {
      if (b.targetType === 'user') await setBanned(db, admin.id, b.targetId, true, b.note);
      else await setHidden(db, admin.id, b.targetType, b.targetId, true, b.note);
      if (b.banAuthor && b.targetType !== 'user') {
        const p = await preview(b.targetType, b.targetId);
        if (p?.authorId) await setBanned(db, admin.id, p.authorId, true, b.note);
      }
    } else {
      await log(db, admin.id, 'dismiss', b.targetType, b.targetId, b.note);
    }
    await q(
      `UPDATE reports SET status = $3, resolved_by = $4, resolved_at = now()
       WHERE target_type = $1 AND target_id = $2 AND status = 'open'`,
      [b.targetType, b.targetId, b.action === 'hide' ? 'actioned' : 'dismissed', admin.id],
      db,
    );
  });
  res.json({ ok: true });
});

adminRoutes.post('/hide', async (req, res) => {
  const admin = requireAdmin(req);
  const b = parse(
    z.object({
      targetType: z.enum(['review', 'photo', 'comment', 'place']),
      targetId: z.number().int().positive(),
      hidden: z.boolean(),
      note: z.string().trim().max(500).default(''),
    }),
    req.body,
  );
  await tx((db) => setHidden(db, admin.id, b.targetType, b.targetId, b.hidden, b.note));
  res.json({ ok: true });
});

adminRoutes.post('/users/:id/ban', async (req, res) => {
  const admin = requireAdmin(req);
  const b = parse(z.object({ banned: z.boolean(), reason: z.string().trim().max(500).default('') }), req.body);
  await tx((db) => setBanned(db, admin.id, Number(req.params.id), b.banned, b.reason));
  res.json({ ok: true });
});

adminRoutes.get('/users', async (req, res) => {
  requireAdmin(req);
  const { q: search } = parse(z.object({ q: z.string().trim().max(100).default('') }), req.query);
  const rows = await q(
    `SELECT u.id, u.display_name, u.email, u.role, u.banned_at, u.ban_reason, u.created_at,
       (SELECT count(*)::int FROM reviews r WHERE r.user_id = u.id) AS review_count,
       (SELECT count(*)::int FROM reports rp WHERE rp.target_type = 'user' AND rp.target_id = u.id) AS report_count
     FROM users u WHERE $1 = '' OR u.display_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%'
     ORDER BY u.id DESC LIMIT 100`,
    [search],
  );
  res.json({
    users: rows.map((u) => ({
      id: u.id, displayName: u.display_name, email: u.email, role: u.role, banned: !!u.banned_at,
      banReason: u.ban_reason, reviewCount: u.review_count, reportCount: u.report_count, createdAt: u.created_at,
    })),
  });
});

adminRoutes.get('/stats', async (req, res) => {
  requireAdmin(req);
  const s = await one(`SELECT
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM places WHERE hidden_at IS NULL) AS places,
    (SELECT count(*)::int FROM reviews WHERE hidden_at IS NULL) AS reviews,
    (SELECT count(*)::int FROM reviews WHERE created_at > now() - interval '1 day') AS reviews_today,
    (SELECT count(DISTINCT (target_type, target_id))::int FROM reports WHERE status = 'open') AS open_reports`);
  res.json({ users: s.users, places: s.places, reviews: s.reviews, reviewsToday: s.reviews_today, openReports: s.open_reports });
});

adminRoutes.put('/content/:key/:language', async (req, res) => {
  const admin = requireAdmin(req);
  const key = parse(z.enum(CONTENT_KEYS), req.params.key);
  const language = parse(z.enum(LANGUAGES), req.params.language);
  const b = parse(z.object({ title: z.string().trim().min(1).max(200), body: z.string().trim().max(50_000) }), req.body);
  await tx(async (db) => {
    await q(
      `INSERT INTO app_content (key, language, title, body, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (key, language) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body,
         updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, language, b.title, b.body, admin.id],
      db,
    );
    await log(db, admin.id, 'edit_content', key, 0, language);
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- public app content (About, Terms, Privacy)

contentRoutes.get('/', async (req, res) => {
  const { lang } = parse(z.object({ lang: z.enum(LANGUAGES).default('en') }), req.query);
  const rows = await q(
    // The chosen language, falling back to English for anything not yet translated.
    `SELECT DISTINCT ON (key) key, language, title, body, updated_at FROM app_content
     WHERE language IN ($1, 'en') ORDER BY key, (language = $1) DESC`,
    [lang],
  );
  res.json({
    content: Object.fromEntries(rows.map((r) => [r.key, { title: r.title, body: r.body, language: r.language, updatedAt: r.updated_at }])),
  });
});
