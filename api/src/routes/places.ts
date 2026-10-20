import { Router } from 'express';
import { z } from 'zod';

import {
  CATEGORIES, CITIES, CITY_IDS, LIMITS, PRICE_BRACKETS, TAGS,
  foldForSearch, isOpenAt, isValidHours, type OpeningHours,
} from '../../../shared';
import { requireActiveUser } from '../auth';
import { one, q } from '../db';
import { HttpError, notFound, parse } from '../http';
import { mediaUrl } from '../media';
import { REVIEW_SELECT, REVIEW_VISIBLE, serializeReviews } from '../serialize';

export const placeRoutes = Router();

/** Name, address, neighbourhood and city (both languages) folded together, for search. */
export function placeSearchText(p: { name: string; address?: string; neighbourhood?: string; city: string }) {
  const city = CITIES.find((c) => c.id === p.city);
  return foldForSearch([p.name, p.address, p.neighbourhood, city?.name, city?.nameVi].filter(Boolean).join(' '));
}

const DISTANCE = (latParam: string, lngParam: string) => `(6371 * 2 * asin(sqrt(
  power(sin(radians(p.lat - ${latParam}) / 2), 2) +
  cos(radians(${latParam})) * cos(radians(p.lat)) * power(sin(radians(p.lng - ${lngParam}) / 2), 2))))`;

// Query strings arrive as text; these turn "a,b" and "true" into real values.
const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(item)).optional();
const bool = z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean()).optional();

const searchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.1).max(100).optional(),
  q: z.string().trim().max(100).optional(),
  category: csv(z.enum(CATEGORIES)),
  price: csv(z.coerce.number().int().min(1).max(PRICE_BRACKETS.length)),
  tags: csv(z.enum(TAGS)),
  minRating: z.coerce.number().min(1).max(5).optional(),
  openNow: bool,
  city: z.enum(CITY_IDS).optional(),
  sort: z.enum(['distance', 'rating', 'newest', 'popular']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

/** Photo shown on cards: the most recent visible review photo. */
const COVER = `(SELECT ph.storage_key FROM photos ph
   JOIN reviews r ON r.id = ph.review_id JOIN users u ON u.id = r.user_id
   WHERE ph.place_id = p.id AND ph.hidden_at IS NULL AND r.hidden_at IS NULL AND u.banned_at IS NULL
   ORDER BY ph.id DESC LIMIT 1)`;

/** Tags any visible review gave the place. */
const PLACE_TAGS = `(SELECT coalesce(array_agg(DISTINCT t), '{}') FROM visible_reviews vr, unnest(vr.tags) t WHERE vr.place_id = p.id)`;

function placeCard(p: any, now: Date) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    address: p.address,
    neighbourhood: p.neighbourhood,
    city: p.city,
    coverUrl: mediaUrl(p.cover_key),
    rating: p.rating,
    reviewCount: p.review_count ?? 0,
    priceBracket: p.price_bracket,
    tags: p.tags ?? [],
    openNow: isOpenAt(p.opening_hours as OpeningHours | null, now, p.timezone),
    distanceKm: p.distance_km == null ? null : Math.round(p.distance_km * 100) / 100,
  };
}

placeRoutes.get('/', async (req, res) => {
  const f = parse(searchSchema, req.query);
  const params: unknown[] = [];
  const add = (v: unknown) => `$${params.push(v)}`;
  const where = ['p.hidden_at IS NULL'];

  const hasPoint = f.lat != null && f.lng != null;
  let distance = 'NULL::float8';
  if (hasPoint) {
    const lat = add(f.lat);
    const lng = add(f.lng);
    distance = DISTANCE(lat, lng);
    if (f.radiusKm) {
      // Cheap box first (uses the index), exact distance after.
      const dLat = f.radiusKm / 111;
      const dLng = f.radiusKm / (111 * Math.max(Math.cos((f.lat! * Math.PI) / 180), 0.01));
      where.push(`p.lat BETWEEN ${add(f.lat! - dLat)} AND ${add(f.lat! + dLat)}`);
      where.push(`p.lng BETWEEN ${add(f.lng! - dLng)} AND ${add(f.lng! + dLng)}`);
      where.push(`${distance} <= ${add(f.radiusKm)}`);
    }
  }
  if (f.q) {
    // Every word must match the place itself or a dish someone reviewed there.
    for (const word of foldForSearch(f.q).split(' ').filter(Boolean).slice(0, 6)) {
      const like = add(`%${word}%`);
      where.push(`(p.search_text LIKE ${like} OR EXISTS (
        SELECT 1 FROM review_dishes d JOIN visible_reviews vr ON vr.id = d.review_id
        WHERE vr.place_id = p.id AND d.name_search LIKE ${like}))`);
    }
  }
  if (f.category?.length) where.push(`p.category = ANY(${add(f.category)})`);
  if (f.city) where.push(`p.city = ${add(f.city)}`);
  if (f.price?.length) where.push(`s.price_bracket = ANY(${add(f.price)})`);
  if (f.minRating) where.push(`s.rating >= ${add(f.minRating)}`);
  if (f.tags?.length) where.push(`${PLACE_TAGS} @> ${add(f.tags)}::text[]`);

  const sort = f.sort ?? (hasPoint ? 'distance' : 'popular');
  const order = {
    distance: hasPoint ? 'distance_km ASC' : 'p.id DESC',
    rating: 's.rating DESC NULLS LAST, s.review_count DESC NULLS LAST',
    newest: 'p.id DESC',
    popular: 's.review_count DESC NULLS LAST, s.rating DESC NULLS LAST',
  }[sort];

  // "Open now" depends on each place's own hours and clock, so it's checked after the query.
  const fetchLimit = f.openNow ? 500 : f.limit;
  const fetchOffset = f.openNow ? 0 : f.offset;
  const rows = await q(
    `SELECT p.*, s.rating, s.review_count, s.price_bracket, ${COVER} AS cover_key, ${PLACE_TAGS} AS tags,
            ${distance} AS distance_km
     FROM places p LEFT JOIN place_stats s ON s.place_id = p.id
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}, p.id DESC
     LIMIT ${add(fetchLimit)} OFFSET ${add(fetchOffset)}`,
    params,
  );
  const now = new Date();
  let places = rows.map((r) => placeCard(r, now));
  if (f.openNow) places = places.filter((p) => p.openNow === true).slice(f.offset, f.offset + f.limit);
  res.json({ places });
});

const placeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORIES),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().max(300).default(''),
  neighbourhood: z.string().trim().max(100).default(''),
  city: z.enum(CITY_IDS).default('da_nang'),
  openingHours: z.unknown().refine((h) => h == null || isValidHours(h), 'bad opening hours').optional(),
  phone: z.string().trim().max(30).default(''),
  zalo: z.string().trim().max(60).default(''),
  allowDuplicate: z.boolean().default(false),
});

placeRoutes.post('/', async (req, res) => {
  const me = requireActiveUser(req);
  const b = parse(placeSchema, req.body);
  const recent = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM places WHERE created_by = $1 AND created_at > now() - interval '1 day'`,
    [me.id],
  );
  if (recent!.n >= LIMITS.placesPerDay) throw new HttpError(429, 'too_many_places');

  // The same stall added twice by two hungry people: point them at the one that exists,
  // unless they've told us it really is a different place with the same name.
  if (!b.allowDuplicate) {
    const nearby = await q(
      `SELECT p.id, p.name FROM places p WHERE p.hidden_at IS NULL AND ${DISTANCE('$1', '$2')} < 0.15`,
      [b.lat, b.lng],
    );
    const dupe = nearby.find((p) => foldForSearch(p.name) === foldForSearch(b.name));
    if (dupe) {
      res.status(409).json({ error: 'place_exists', message: 'This place is already on the map', place: { id: dupe.id, name: dupe.name } });
      return;
    }
  }
  const p = await one(
    `INSERT INTO places (name, category, lat, lng, address, neighbourhood, city, opening_hours, phone, zalo, search_text, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [b.name, b.category, b.lat, b.lng, b.address, b.neighbourhood, b.city, b.openingHours ?? null, b.phone, b.zalo, placeSearchText(b), me.id],
  );
  res.status(201).json(await placeDetail(p!.id, me.id));
});

/** The creator can fix their own typo for a day; after that (or any time) admins can. */
placeRoutes.patch('/:id', async (req, res) => {
  const me = requireActiveUser(req);
  const id = Number(req.params.id);
  const place = await one('SELECT * FROM places WHERE id = $1', [id]);
  if (!place) throw notFound();
  const ownFresh = place.created_by === me.id && Date.now() - new Date(place.created_at).getTime() < 86_400_000;
  if (!ownFresh && me.role !== 'admin') throw new HttpError(403, 'cannot_edit_place');
  const b = parse(placeSchema.partial(), req.body);
  const next = {
    name: b.name ?? place.name,
    category: b.category ?? place.category,
    lat: b.lat ?? place.lat,
    lng: b.lng ?? place.lng,
    address: b.address ?? place.address,
    neighbourhood: b.neighbourhood ?? place.neighbourhood,
    city: b.city ?? place.city,
    opening_hours: b.openingHours === undefined ? place.opening_hours : b.openingHours,
    phone: b.phone ?? place.phone,
    zalo: b.zalo ?? place.zalo,
  };
  await q(
    `UPDATE places SET name=$2, category=$3, lat=$4, lng=$5, address=$6, neighbourhood=$7, city=$8,
       opening_hours=$9, phone=$10, zalo=$11, search_text=$12, updated_at=now() WHERE id=$1`,
    [id, next.name, next.category, next.lat, next.lng, next.address, next.neighbourhood, next.city,
      next.opening_hours ?? null, next.phone, next.zalo, placeSearchText(next)],
  );
  await q('INSERT INTO place_edits (place_id, user_id, changes) VALUES ($1, $2, $3)', [id, me.id, JSON.stringify(b)]);
  res.json(await placeDetail(id, me.id));
});

export async function placeDetail(id: number, viewerId?: number, isAdmin = false) {
  const p = await one(
    `SELECT p.*, s.*, ${PLACE_TAGS} AS tags, ${COVER} AS cover_key,
       EXISTS (SELECT 1 FROM place_claims c WHERE c.place_id = p.id AND c.status = 'approved') AS claimed
     FROM places p LEFT JOIN place_stats s ON s.place_id = p.id WHERE p.id = $1`,
    [id],
  );
  if (!p || (p.hidden_at && !isAdmin)) throw notFound();

  const [tagCounts, dishes, photos, savedIn] = await Promise.all([
    q(
      `SELECT t AS tag, count(*)::int AS n FROM visible_reviews vr, unnest(vr.tags) t
       WHERE vr.place_id = $1 GROUP BY t ORDER BY n DESC, t`,
      [id],
    ),
    // Popular dishes: what reviewers named most, with how many gave it a thumbs up.
    q(
      `SELECT d.name_search,
              mode() WITHIN GROUP (ORDER BY d.name) AS name,
              count(*)::int AS mentions,
              count(*) FILTER (WHERE d.thumbs_up)::int AS thumbs_up,
              (array_agg(ph.storage_key ORDER BY ph.id DESC) FILTER (WHERE ph.storage_key IS NOT NULL))[1] AS photo_key
       FROM review_dishes d
       JOIN visible_reviews vr ON vr.id = d.review_id
       LEFT JOIN photos ph ON ph.id = d.photo_id AND ph.hidden_at IS NULL
       WHERE vr.place_id = $1
       GROUP BY d.name_search
       ORDER BY count(*) DESC, count(*) FILTER (WHERE d.thumbs_up) DESC
       LIMIT 10`,
      [id],
    ),
    q(
      `SELECT ph.id, ph.storage_key, ph.width, ph.height FROM photos ph
       JOIN visible_reviews vr ON vr.id = ph.review_id
       WHERE ph.place_id = $1 AND ph.hidden_at IS NULL ORDER BY ph.id DESC LIMIT 30`,
      [id],
    ),
    viewerId
      ? q(`SELECT li.list_id FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.user_id = $1 AND li.place_id = $2`, [viewerId, id])
      : Promise.resolve([]),
  ]);

  return {
    ...placeCard({ ...p, id }, new Date()),
    hidden: !!p.hidden_at,
    timezone: p.timezone,
    openingHours: p.opening_hours,
    phone: p.phone,
    zalo: p.zalo,
    ratings: { taste: p.taste, value: p.value, service: p.service, vibe: p.vibe, cleanliness: p.cleanliness },
    tagCounts: tagCounts.map((t) => ({ tag: t.tag, count: t.n })),
    popularDishes: dishes.map((d) => ({
      name: d.name, mentions: d.mentions, thumbsUp: d.thumbs_up, photoUrl: mediaUrl(d.photo_key),
    })),
    photos: photos.map((ph) => ({ id: ph.id, url: mediaUrl(ph.storage_key), width: ph.width, height: ph.height })),
    savedInLists: savedIn.map((s) => s.list_id),
    claimed: p.claimed,
    createdBy: p.created_by,
    createdAt: p.created_at,
  };
}

placeRoutes.get('/:id', async (req, res) => {
  res.json(await placeDetail(Number(req.params.id), req.user?.id, req.user?.role === 'admin'));
});

placeRoutes.get('/:id/reviews', async (req, res) => {
  const f = parse(
    z.object({
      sort: z.enum(['recent', 'helpful']).default('recent'),
      before: z.coerce.number().int().optional(),
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
    req.query,
  );
  const id = Number(req.params.id);
  const rows =
    f.sort === 'helpful'
      ? await q(`${REVIEW_SELECT} WHERE r.place_id = $1 AND ${REVIEW_VISIBLE}
                 ORDER BY helpful_count DESC, r.id DESC LIMIT $2 OFFSET $3`, [id, f.limit, f.offset])
      : await q(`${REVIEW_SELECT} WHERE r.place_id = $1 AND ${REVIEW_VISIBLE} AND ($2::bigint IS NULL OR r.id < $2)
                 ORDER BY r.id DESC LIMIT $3`, [id, f.before ?? null, f.limit]);
  res.json({ reviews: await serializeReviews(rows, req.user?.id) });
});
