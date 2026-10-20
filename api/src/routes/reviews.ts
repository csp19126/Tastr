import { Router } from 'express';
import { z } from 'zod';

import { CURRENCIES, LIMITS, TAGS, foldForSearch } from '../../../shared';
import { requireActiveUser, requireUser } from '../auth';
import { one, q, tx, type Db } from '../db';
import { HttpError, notFound, parse } from '../http';
import { deletePhotoFiles, mediaUrl, processPhoto, storePhoto } from '../media';
import { REVIEW_SELECT, publicUser, serializeReviews } from '../serialize';
import { upload } from './me';

export const reviewRoutes = Router();
export const photoRoutes = Router();
export const commentRoutes = Router();

// ---------------------------------------------------------------- photos
// Photos go up first (one at a time, so a dropped connection loses one photo, not ten),
// then the review is posted with their ids.

photoRoutes.post('/', upload.single('photo'), async (req, res) => {
  const me = requireActiveUser(req);
  if (!req.file) throw new HttpError(400, 'not_a_photo');
  const today = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM photos WHERE user_id = $1 AND created_at > now() - interval '1 day'`,
    [me.id],
  );
  if (today!.n >= LIMITS.reviewsPerDay * (LIMITS.photosPerReview + LIMITS.dishesPerReview)) {
    throw new HttpError(429, 'too_many_photos');
  }
  const { data, width, height } = await processPhoto(req.file.buffer);
  const key = await storePhoto(data);
  const p = await one(
    'INSERT INTO photos (user_id, storage_key, width, height) VALUES ($1, $2, $3, $4) RETURNING id',
    [me.id, key, width, height],
  );
  res.status(201).json({ id: p!.id, url: mediaUrl(key), width, height });
});

// ---------------------------------------------------------------- reviews

const ratingSchema = z.number().int().min(1).max(5).nullable().optional();

const reviewSchema = z.object({
  placeId: z.number().int().positive(),
  paws: z.number().int().min(1).max(5),
  ratings: z
    .object({ taste: ratingSchema, value: ratingSchema, service: ratingSchema, vibe: ratingSchema, cleanliness: ratingSchema })
    .default({}),
  body: z.string().trim().min(LIMITS.reviewBodyMin).max(LIMITS.reviewBodyMax),
  pricePaid: z.number().min(0).max(1e12).nullable().optional(),
  currency: z.enum(CURRENCIES).default('VND'),
  priceBracket: z.number().int().min(1).max(4).nullable().optional(),
  tags: z.array(z.enum(TAGS)).max(TAGS.length).default([]),
  // No default on purpose: the app must ask, every time.
  sponsored: z.boolean(),
  visitedOn: z.iso.date().nullable().optional(),
  photoIds: z.array(z.number().int().positive()).max(LIMITS.photosPerReview).default([]),
  dishes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        thumbsUp: z.boolean(),
        note: z.string().trim().max(300).default(''),
        photoId: z.number().int().positive().nullable().optional(),
      }),
    )
    .max(LIMITS.dishesPerReview)
    .default([]),
});
type ReviewInput = z.infer<typeof reviewSchema>;

/**
 * Photos must be the author's own and not already used by a different review.
 * Returns the storage keys of photos the author removed while editing, now deleted.
 */
async function attachPhotos(db: Db, reviewId: number, placeId: number, userId: number, input: Omit<ReviewInput, 'placeId'>) {
  const dishPhotoIds = input.dishes.map((d) => d.photoId).filter((x): x is number => !!x);
  const all = [...new Set([...input.photoIds, ...dishPhotoIds])];
  if (all.length) {
    const ok = await q(
      `SELECT id FROM photos WHERE id = ANY($1) AND user_id = $2 AND (review_id IS NULL OR review_id = $3)`,
      [all, userId, reviewId],
      db,
    );
    if (ok.length !== all.length) throw new HttpError(400, 'bad_photo');
  }
  const removed = await q<{ storage_key: string }>(
    'DELETE FROM photos WHERE review_id = $1 AND NOT (id = ANY($2)) RETURNING storage_key',
    [reviewId, all],
    db,
  );
  for (const [i, id] of all.entries()) {
    await q('UPDATE photos SET review_id = $2, place_id = $3, position = $4 WHERE id = $1', [id, reviewId, placeId, i], db);
  }
  await q('DELETE FROM review_dishes WHERE review_id = $1', [reviewId], db);
  for (const [i, d] of input.dishes.entries()) {
    await q(
      `INSERT INTO review_dishes (review_id, name, name_search, thumbs_up, note, photo_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [reviewId, d.name, foldForSearch(d.name), d.thumbsUp, d.note, d.photoId ?? null, i],
      db,
    );
  }
  return removed.map((p) => p.storage_key);
}

function reviewValues(b: Omit<ReviewInput, 'placeId'>) {
  return [
    b.paws, b.ratings.taste ?? null, b.ratings.value ?? null, b.ratings.service ?? null, b.ratings.vibe ?? null,
    b.ratings.cleanliness ?? null, b.body, b.pricePaid ?? null, b.currency, b.priceBracket ?? null, b.tags,
    b.sponsored, b.visitedOn ?? null,
  ];
}

export async function getReview(id: number, viewer?: { id: number; role: string }) {
  const row = await one(`${REVIEW_SELECT} WHERE r.id = $1`, [id]);
  if (!row) throw notFound();
  const visible = !row.hidden_at && !row.author_banned_at && !row.place_hidden_at;
  if (!visible && viewer?.id !== row.user_id && viewer?.role !== 'admin') throw notFound();
  const [review] = await serializeReviews([row], viewer?.id);
  return review;
}

reviewRoutes.post('/', async (req, res) => {
  const me = requireActiveUser(req);
  const b = parse(reviewSchema, req.body);
  const place = await one('SELECT id FROM places WHERE id = $1 AND hidden_at IS NULL', [b.placeId]);
  if (!place) throw notFound();

  const id = await tx(async (db) => {
    // Serialise one person's posts so two quick taps can't both slip under the limits.
    await q('SELECT id FROM users WHERE id = $1 FOR UPDATE', [me.id], db);
    const today = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM reviews WHERE user_id = $1 AND created_at > now() - interval '1 day'`,
      [me.id],
      db,
    );
    if (today!.n >= LIMITS.reviewsPerDay) throw new HttpError(429, 'too_many_reviews');
    const samePlace = await one(
      `SELECT id FROM reviews WHERE user_id = $1 AND place_id = $2
       AND created_at > now() - make_interval(days => $3)`,
      [me.id, b.placeId, LIMITS.daysBetweenReviewsOfSamePlace],
      db,
    );
    if (samePlace) throw new HttpError(409, 'reviewed_recently');

    const r = await one<{ id: number }>(
      `INSERT INTO reviews (place_id, user_id, paws, taste, value, service, vibe, cleanliness, body,
         price_paid, currency, price_bracket, tags, sponsored, visited_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
      [b.placeId, me.id, ...reviewValues(b)],
      db,
    );
    await attachPhotos(db, r!.id, b.placeId, me.id, b);
    return r!.id;
  });
  res.status(201).json(await getReview(id, me));
});

reviewRoutes.get('/:id', async (req, res) => {
  res.json(await getReview(Number(req.params.id), req.user));
});

reviewRoutes.put('/:id', async (req, res) => {
  const me = requireActiveUser(req);
  const id = Number(req.params.id);
  const existing = await one('SELECT * FROM reviews WHERE id = $1', [id]);
  if (!existing || existing.user_id !== me.id) throw notFound();
  const b = parse(reviewSchema.omit({ placeId: true }), req.body);
  const removed = await tx(async (db) => {
    await q(
      `UPDATE reviews SET paws=$2, taste=$3, value=$4, service=$5, vibe=$6, cleanliness=$7, body=$8,
         price_paid=$9, currency=$10, price_bracket=$11, tags=$12, sponsored=$13, visited_on=$14, updated_at=now()
       WHERE id = $1`,
      [id, ...reviewValues(b)],
      db,
    );
    return attachPhotos(db, id, existing.place_id, me.id, b);
  });
  await deletePhotoFiles(removed);
  res.json(await getReview(id, me));
});

reviewRoutes.delete('/:id', async (req, res) => {
  const me = requireUser(req);
  const id = Number(req.params.id);
  const existing = await one('SELECT user_id FROM reviews WHERE id = $1', [id]);
  if (!existing || (existing.user_id !== me.id && me.role !== 'admin')) throw notFound();
  const photos = await q<{ storage_key: string }>('DELETE FROM photos WHERE review_id = $1 RETURNING storage_key', [id]);
  await q('DELETE FROM reviews WHERE id = $1', [id]);
  await deletePhotoFiles(photos.map((p) => p.storage_key));
  res.json({ ok: true });
});

// "Helpful" votes: one per person, never on your own review.
reviewRoutes.post('/:id/helpful', async (req, res) => {
  const me = requireActiveUser(req);
  const review = await getReview(Number(req.params.id), me);
  if (review.author.id === me.id) throw new HttpError(400, 'own_review');
  await q('INSERT INTO helpful_votes (review_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [review.id, me.id]);
  res.json(await getReview(review.id, me));
});

reviewRoutes.delete('/:id/helpful', async (req, res) => {
  const me = requireUser(req);
  await q('DELETE FROM helpful_votes WHERE review_id = $1 AND user_id = $2', [Number(req.params.id), me.id]);
  res.json(await getReview(Number(req.params.id), me));
});

// ---------------------------------------------------------------- comments

function serializeComment(c: any) {
  return {
    id: c.id,
    reviewId: c.review_id,
    body: c.body,
    author: publicUser({ id: c.user_id, display_name: c.display_name, photo_key: c.photo_key }),
    createdAt: c.created_at,
  };
}

reviewRoutes.get('/:id/comments', async (req, res) => {
  const review = await getReview(Number(req.params.id), req.user);
  const rows = await q(
    `SELECT c.*, u.display_name, u.photo_key FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.review_id = $1 AND c.hidden_at IS NULL AND u.banned_at IS NULL ORDER BY c.id LIMIT 500`,
    [review.id],
  );
  res.json({ comments: rows.map(serializeComment) });
});

reviewRoutes.post('/:id/comments', async (req, res) => {
  const me = requireActiveUser(req);
  const review = await getReview(Number(req.params.id), me);
  const { body } = parse(z.object({ body: z.string().trim().min(1).max(LIMITS.commentMax) }), req.body);
  const recent = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM comments WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [me.id],
  );
  if (recent!.n >= LIMITS.commentsPerHour) throw new HttpError(429, 'too_many_comments');
  const c = await one(
    `WITH c AS (INSERT INTO comments (review_id, user_id, body) VALUES ($1, $2, $3) RETURNING *)
     SELECT c.*, u.display_name, u.photo_key FROM c JOIN users u ON u.id = c.user_id`,
    [review.id, me.id, body],
  );
  res.status(201).json(serializeComment(c));
});

commentRoutes.delete('/:id', async (req, res) => {
  const me = requireUser(req);
  const c = await one('SELECT user_id FROM comments WHERE id = $1', [Number(req.params.id)]);
  if (!c || (c.user_id !== me.id && me.role !== 'admin')) throw notFound();
  await q('DELETE FROM comments WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
});

