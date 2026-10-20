import { Router } from 'express';
import { z } from 'zod';

import { requireActiveUser, requireUser } from '../auth';
import { one, q } from '../db';
import { HttpError, notFound, parse } from '../http';
import { REVIEW_SELECT, REVIEW_VISIBLE, publicUser, serializeReviews } from '../serialize';

export const userRoutes = Router();
export const feedRoutes = Router();

const page = z.object({
  before: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

userRoutes.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const u = await one(
    `SELECT u.*,
       (SELECT count(*)::int FROM reviews r WHERE r.user_id = u.id AND r.hidden_at IS NULL) AS review_count,
       (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS follower_count,
       (SELECT count(*)::int FROM follows f WHERE f.follower_id = u.id) AS following_count,
       (SELECT count(*)::int FROM helpful_votes h JOIN reviews r ON r.id = h.review_id WHERE r.user_id = u.id) AS helpful_count,
       EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followee_id = u.id) AS is_following
     FROM users u WHERE u.id = $1`,
    [id, req.user?.id ?? 0],
  );
  if (!u || (u.banned_at && req.user?.role !== 'admin')) throw notFound();
  res.json({
    ...publicUser(u),
    bio: u.bio,
    reviewCount: u.review_count,
    followerCount: u.follower_count,
    followingCount: u.following_count,
    helpfulCount: u.helpful_count,
    isFollowing: u.is_following,
    banned: !!u.banned_at,
    joinedAt: u.created_at,
  });
});

userRoutes.get('/:id/reviews', async (req, res) => {
  const f = parse(page, req.query);
  const rows = await q(
    `${REVIEW_SELECT} WHERE r.user_id = $1 AND ${REVIEW_VISIBLE} AND ($2::bigint IS NULL OR r.id < $2)
     ORDER BY r.id DESC LIMIT $3`,
    [Number(req.params.id), f.before ?? null, f.limit],
  );
  res.json({ reviews: await serializeReviews(rows, req.user?.id) });
});

userRoutes.post('/:id/follow', async (req, res) => {
  const me = requireActiveUser(req);
  const id = Number(req.params.id);
  if (id === me.id) throw new HttpError(400, 'cannot_follow_self');
  const target = await one('SELECT id FROM users WHERE id = $1 AND banned_at IS NULL', [id]);
  if (!target) throw notFound();
  await q('INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [me.id, id]);
  res.json({ following: true });
});

userRoutes.delete('/:id/follow', async (req, res) => {
  const me = requireUser(req);
  await q('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2', [me.id, Number(req.params.id)]);
  res.json({ following: false });
});

/**
 * following: reviews from people you follow.
 * city: the newest reviews of places in a city (yours by default), from everyone.
 */
feedRoutes.get('/', async (req, res) => {
  const f = parse(page.extend({ scope: z.enum(['following', 'city']).default('city'), city: z.string().max(40).optional() }), req.query);
  if (f.scope === 'following') {
    const me = requireUser(req);
    const rows = await q(
      `${REVIEW_SELECT} WHERE ${REVIEW_VISIBLE}
         AND r.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $1)
         AND ($2::bigint IS NULL OR r.id < $2)
       ORDER BY r.id DESC LIMIT $3`,
      [me.id, f.before ?? null, f.limit],
    );
    res.json({ reviews: await serializeReviews(rows, me.id) });
    return;
  }
  let city = f.city;
  if (!city && req.user) city = (await one('SELECT home_city FROM users WHERE id = $1', [req.user.id]))?.home_city;
  const rows = await q(
    `${REVIEW_SELECT} WHERE ${REVIEW_VISIBLE} AND ($1::text IS NULL OR p.city = $1)
       AND ($2::bigint IS NULL OR r.id < $2)
     ORDER BY r.id DESC LIMIT $3`,
    [city ?? null, f.before ?? null, f.limit],
  );
  res.json({ reviews: await serializeReviews(rows, req.user?.id) });
});
