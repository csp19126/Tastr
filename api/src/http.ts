import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    /** Stable code the app translates into a friendly message. */
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const notFound = () => new HttpError(404, 'not_found');

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, 'invalid_input', `${first.path.join('.') || 'input'}: ${first.message}`);
  }
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  const e = err as { type?: string; code?: string; status?: number };
  if (e?.type === 'entity.parse.failed' || e?.type === 'entity.too.large') {
    res.status(e.status ?? 400).json({ error: 'invalid_input', message: e.type });
    return;
  }
  if (e?.code === 'LIMIT_FILE_SIZE' || e?.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ error: 'photo_too_big', message: e.code });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'server_error', message: 'Something went wrong' });
}

/** A small in-memory limiter for sign-up/log-in by IP; the per-account limits live in the database. */
export function ipLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      return next();
    }
    if (++h.n > max) return next(new HttpError(429, 'slow_down'));
    next();
  };
}
