import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { CITY_IDS, CURRENCIES, LANGUAGES, LIMITS } from '../../../shared';
import { requireUser } from '../auth';
import { one, pool, q, tx, type Db } from '../db';
import { HttpError, notFound, parse } from '../http';
import { deletePhotoFiles, mediaUrl, processPhoto, storePhoto } from '../media';

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITS.photoMaxBytes, files: 1 } });

export async function privateUser(id: number, db: Db = pool) {
  const u = await one('SELECT * FROM users WHERE id = $1', [id], db);
  if (!u) throw notFound();
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    photoUrl: mediaUrl(u.photo_key),
    homeCity: u.home_city,
    bio: u.bio,
    language: u.language,
    currency: u.currency,
    notifications: { follows: u.notify_follows, comments: u.notify_comments, helpful: u.notify_helpful },
    role: u.role,
    banned: !!u.banned_at,
    signInMethods: [u.password_hash && 'email', u.google_sub && 'google', u.apple_sub && 'apple'].filter(Boolean),
    createdAt: u.created_at,
  };
}

export const meRoutes = Router();

meRoutes.get('/', async (req, res) => {
  res.json(await privateUser(requireUser(req).id));
});

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(LIMITS.bioMax).optional(),
  homeCity: z.enum(CITY_IDS).optional(),
  language: z.enum(LANGUAGES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  notifications: z
    .object({ follows: z.boolean().optional(), comments: z.boolean().optional(), helpful: z.boolean().optional() })
    .optional(),
});

meRoutes.patch('/', async (req, res) => {
  const me = requireUser(req);
  const b = parse(patchSchema, req.body);
  await q(
    `UPDATE users SET
       display_name = COALESCE($2, display_name), bio = COALESCE($3, bio), home_city = COALESCE($4, home_city),
       language = COALESCE($5, language), currency = COALESCE($6, currency),
       notify_follows = COALESCE($7, notify_follows), notify_comments = COALESCE($8, notify_comments),
       notify_helpful = COALESCE($9, notify_helpful)
     WHERE id = $1`,
    [
      me.id, b.displayName, b.bio, b.homeCity, b.language, b.currency,
      b.notifications?.follows, b.notifications?.comments, b.notifications?.helpful,
    ],
  );
  res.json(await privateUser(me.id));
});

meRoutes.put('/photo', upload.single('photo'), async (req, res) => {
  const me = requireUser(req);
  if (!req.file) throw new HttpError(400, 'not_a_photo');
  const { data } = await processPhoto(req.file.buffer);
  const key = await storePhoto(data);
  const old = await one('SELECT photo_key FROM users WHERE id = $1', [me.id]);
  await q('UPDATE users SET photo_key = $2 WHERE id = $1', [me.id, key]);
  await deletePhotoFiles([old?.photo_key]);
  res.json(await privateUser(me.id));
});

/**
 * "Delete my account and all my data": the account, sessions, reviews, photos (files too),
 * comments, votes, lists and follows go. Places someone added stay for everyone, and reports
 * they filed about other people's content stay for the moderators; both lose any link to them.
 */
meRoutes.delete('/', async (req, res) => {
  const me = requireUser(req);
  const keys = await tx(async (db) => {
    const photos = await q<{ storage_key: string }>('SELECT storage_key FROM photos WHERE user_id = $1', [me.id], db);
    const u = await one('SELECT photo_key FROM users WHERE id = $1', [me.id], db);
    await q('DELETE FROM users WHERE id = $1', [me.id], db); // everything else cascades
    return [...photos.map((p) => p.storage_key), u?.photo_key];
  });
  await deletePhotoFiles(keys);
  res.json({ ok: true });
});
