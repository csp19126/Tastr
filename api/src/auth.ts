import crypto from 'node:crypto';
import { promisify } from 'node:util';

import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { config } from './config';
import { one, q, type Db } from './db';
import { HttpError } from './http';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [, salt, key] = stored.split('$');
  const want = Buffer.from(key, 'base64');
  const got = await scrypt(password, Buffer.from(salt, 'base64'), want.length);
  return crypto.timingSafeEqual(want, got);
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** A long random bearer token. Only its hash is stored, so a database leak can't be replayed. */
export async function createSession(userId: number, db?: Db) {
  const token = crypto.randomBytes(32).toString('base64url');
  await q('INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)', [sha256(token), userId], db);
  return token;
}

export async function endSession(token: string) {
  await q('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

export type AuthUser = {
  id: number;
  email: string | null;
  role: 'user' | 'admin';
  banned_at: Date | null;
  language: 'en' | 'vi';
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
    }
  }
}

function bearer(req: Request) {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
}

/** Reads the token if there is one. Never fails: anonymous visitors can browse. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return next();
  const user = await one<AuthUser>(
    `UPDATE sessions s SET last_used = now() FROM users u
     WHERE s.token_hash = $1 AND u.id = s.user_id
     RETURNING u.id, u.email, u.role, u.banned_at, u.language`,
    [sha256(token)],
  );
  if (user) {
    req.user = user;
    req.token = token;
  }
  next();
}

export function requireUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'sign_in_needed');
  return req.user;
}

/** Signed in and not banned: needed for anything that posts content. */
export function requireActiveUser(req: Request): AuthUser {
  const u = requireUser(req);
  if (u.banned_at) throw new HttpError(403, 'banned');
  return u;
}

export function requireAdmin(req: Request): AuthUser {
  const u = requireUser(req);
  if (u.role !== 'admin') throw new HttpError(403, 'admins_only');
  return u;
}

export function roleFor(email: string | null | undefined) {
  return email && config.adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';
}

// ---------------------------------------------------------------- Google and Apple sign-in

export type SocialProfile = { sub: string; email: string | null; emailVerified: boolean; name: string | null };

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const truthy = (v: unknown) => v === true || v === 'true';

/** Checks the ID token the phone got from Google/Apple really was issued for our app. Tests swap this out. */
export const socialVerifier = {
  async google(idToken: string): Promise<SocialProfile> {
    if (config.googleClientIds.length === 0) throw new HttpError(501, 'google_not_configured');
    const { payload } = await jwtVerify(idToken, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: config.googleClientIds,
    }).catch(() => {
      throw new HttpError(401, 'bad_token');
    });
    return {
      sub: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      emailVerified: truthy(payload.email_verified),
      name: typeof payload.name === 'string' ? payload.name : null,
    };
  },
  async apple(identityToken: string): Promise<SocialProfile> {
    if (config.appleBundleIds.length === 0) throw new HttpError(501, 'apple_not_configured');
    const { payload } = await jwtVerify(identityToken, appleKeys, {
      issuer: 'https://appleid.apple.com',
      audience: config.appleBundleIds,
    }).catch(() => {
      throw new HttpError(401, 'bad_token');
    });
    return {
      sub: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      emailVerified: truthy(payload.email_verified),
      name: null,
    };
  },
};
