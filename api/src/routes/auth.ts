import crypto from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { CITY_IDS, LANGUAGES } from '../../../shared';
import { checkPassword, createSession, endSession, hashPassword, requireUser, roleFor, socialVerifier, type FacebookCredential, type SocialProfile } from '../auth';
import { config } from '../config';
import { one, q, tx, type Db } from '../db';
import { HttpError, ipLimiter, parse } from '../http';
import { mailer, resetCodeEmail } from '../mailer';
import { privateUser } from './me';

export const authRoutes = Router();

const limiter = ipLimiter(config.authAttemptsPer15Min, 15 * 60_000);

const registerSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(50),
  language: z.enum(LANGUAGES).default('en'),
  homeCity: z.enum(CITY_IDS).default('da_nang'),
});

export function newShareSlug() {
  return crypto.randomBytes(9).toString('base64url');
}

/** Everyone starts with the two lists people actually use. */
async function createStarterLists(userId: number, db: Db) {
  for (const kind of ['want_to_try', 'date_night']) {
    await q('INSERT INTO lists (user_id, kind, share_slug) VALUES ($1, $2, $3)', [userId, kind, newShareSlug()], db);
  }
}

async function signedIn(userId: number, db?: Db) {
  const token = await createSession(userId, db);
  const user = await privateUser(userId, db);
  return { token, user };
}

authRoutes.post('/register', limiter, async (req, res) => {
  const body = parse(registerSchema, req.body);
  const email = body.email.toLowerCase();
  const hash = await hashPassword(body.password);
  const out = await tx(async (db) => {
    const existing = await one('SELECT id FROM users WHERE email = $1', [email], db);
    if (existing) throw new HttpError(409, 'email_taken');
    const u = await one<{ id: number }>(
      `INSERT INTO users (email, password_hash, display_name, language, home_city, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [email, hash, body.displayName, body.language, body.homeCity, roleFor(email)],
      db,
    );
    await createStarterLists(u!.id, db);
    return signedIn(u!.id, db);
  });
  res.status(201).json(out);
});

authRoutes.post('/login', limiter, async (req, res) => {
  const body = parse(z.object({ email: z.string().max(200), password: z.string().max(200) }), req.body);
  const u = await one('SELECT id, password_hash, email FROM users WHERE email = $1', [body.email.trim().toLowerCase()]);
  if (!u || !(await checkPassword(body.password, u.password_hash))) throw new HttpError(401, 'wrong_login');
  // Someone added to ADMIN_EMAILS after signing up gets the admin screen on their next log-in.
  if (roleFor(u.email) === 'admin') await q(`UPDATE users SET role = 'admin' WHERE id = $1`, [u.id]);
  res.json(await signedIn(u.id));
});

const SUB_COLUMN = { google: 'google_sub', apple: 'apple_sub', facebook: 'facebook_sub' } as const;

/**
 * Same flow for Google, Apple and Facebook: find the account by provider id, else by verified email
 * (so someone who signed up with email can later tap "Continue with Google"), else create one.
 */
async function socialSignIn(provider: keyof typeof SUB_COLUMN, p: SocialProfile, fallbackName: string, language: 'en' | 'vi') {
  const col = SUB_COLUMN[provider];
  return tx(async (db) => {
    let u = await one<{ id: number }>(`SELECT id FROM users WHERE ${col} = $1`, [p.sub], db);
    if (!u && p.email && p.emailVerified) {
      u = await one(`UPDATE users SET ${col} = $2 WHERE email = $1 AND ${col} IS NULL RETURNING id`, [p.email, p.sub], db);
    }
    if (!u) {
      const name = (p.name || fallbackName || p.email?.split('@')[0] || 'Hungry diner').slice(0, 50);
      u = await one(
        `INSERT INTO users (email, ${col}, display_name, language, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [p.email && p.emailVerified ? p.email : null, p.sub, name, language, roleFor(p.emailVerified ? p.email : null)],
        db,
      );
      await createStarterLists(u!.id, db);
    }
    return signedIn(u!.id, db);
  });
}

authRoutes.post('/google', limiter, async (req, res) => {
  const body = parse(z.object({ idToken: z.string().min(10), language: z.enum(LANGUAGES).default('en') }), req.body);
  const profile = await socialVerifier.google(body.idToken);
  res.json(await socialSignIn('google', profile, '', body.language));
});

authRoutes.post('/apple', limiter, async (req, res) => {
  const body = parse(
    z.object({
      identityToken: z.string().min(10),
      // Apple only sends the name on the very first sign-in, from the phone, not in the token.
      fullName: z.string().trim().max(50).optional(),
      language: z.enum(LANGUAGES).default('en'),
    }),
    req.body,
  );
  const profile = await socialVerifier.apple(body.identityToken);
  res.json(await socialSignIn('apple', profile, body.fullName ?? '', body.language));
});

authRoutes.post('/facebook', limiter, async (req, res) => {
  const body = parse(
    z.object({
      accessToken: z.string().min(10).max(4000).optional(),
      authenticationToken: z.string().min(10).max(8000).optional(),
      nonce: z.string().min(8).max(200).optional(),
      language: z.enum(LANGUAGES).default('en'),
    }),
    req.body,
  );
  let cred: FacebookCredential;
  if (body.authenticationToken && body.nonce) cred = { authenticationToken: body.authenticationToken, nonce: body.nonce };
  else if (body.accessToken) cred = { accessToken: body.accessToken };
  else throw new HttpError(400, 'bad_token');
  const profile = await socialVerifier.facebook(cred);
  res.json(await socialSignIn('facebook', profile, '', body.language));
});

authRoutes.post('/logout', async (req, res) => {
  requireUser(req);
  await endSession(req.token!);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- forgot password

const RESET_MINUTES = 15;
const RESET_TRIES = 5;
const RESETS_PER_HOUR = 3;

const resetHash = (userId: number, code: string) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

/**
 * Emails a 6-digit code. Always answers "ok" whether or not the email has an account,
 * so nobody can use this to find out who's signed up.
 */
authRoutes.post('/forgot', limiter, async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().max(200) }), req.body);
  if (!mailer.configured()) throw new HttpError(503, 'email_not_configured');
  const u = await one('SELECT id, display_name, language FROM users WHERE email = $1 AND banned_at IS NULL', [email.toLowerCase()]);
  if (!u) {
    res.json({ ok: true });
    return;
  }
  const recent = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [u.id],
  );
  if (recent!.n >= RESETS_PER_HOUR) {
    res.json({ ok: true });
    return;
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const row = await tx(async (db) => {
    // Only the newest code works.
    await q('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [u.id], db);
    return one<{ id: number }>(
      `INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3)) RETURNING id`,
      [u.id, resetHash(u.id, code), RESET_MINUTES],
      db,
    );
  });
  try {
    await mailer.send(resetCodeEmail(email.toLowerCase(), u.display_name, code, u.language));
  } catch (e) {
    await q('DELETE FROM password_resets WHERE id = $1', [row!.id]);
    throw e;
  }
  res.json({ ok: true });
});

/** Code + new password: sets it, signs out every other device, and signs this one in. */
authRoutes.post('/reset', limiter, async (req, res) => {
  const b = parse(
    z.object({
      email: z.string().trim().max(200),
      code: z.string().trim().regex(/^\d{6}$/),
      password: z.string().min(8).max(200),
    }),
    req.body,
  );
  const u = await one<{ id: number }>('SELECT id FROM users WHERE email = $1 AND banned_at IS NULL', [b.email.toLowerCase()]);
  if (!u) throw new HttpError(400, 'bad_code');
  const hash = await hashPassword(b.password);
  const out = await tx(async (db) => {
    const r = await one(
      `SELECT * FROM password_resets WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [u.id],
      db,
    );
    if (!r || r.attempts >= RESET_TRIES) return null;
    const ok = crypto.timingSafeEqual(Buffer.from(r.code_hash, 'hex'), Buffer.from(resetHash(u.id, b.code), 'hex'));
    if (!ok) {
      await q('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [r.id], db);
      return null;
    }
    await q('UPDATE password_resets SET used_at = now() WHERE id = $1', [r.id], db);
    await q('UPDATE users SET password_hash = $2 WHERE id = $1', [u.id, hash], db);
    await q('DELETE FROM sessions WHERE user_id = $1', [u.id], db);
    return signedIn(u.id, db);
  });
  if (!out) throw new HttpError(400, 'bad_code');
  res.json(out);
});
