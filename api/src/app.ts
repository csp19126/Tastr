import fs from 'node:fs';

import express from 'express';

import { loadUser } from './auth';
import { pool } from './db';
import { errorHandler, notFound } from './http';
import { mediaPath } from './media';
import { authRoutes } from './routes/auth';
import { listRoutes, sharePageRoutes, sharedListRoutes } from './routes/lists';
import { meRoutes } from './routes/me';
import { adminRoutes, contentRoutes, reportRoutes } from './routes/moderation';
import { placeRoutes } from './routes/places';
import { commentRoutes, photoRoutes, reviewRoutes } from './routes/reviews';
import { feedRoutes, userRoutes } from './routes/social';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Railway and most hosts sit behind one proxy
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // The phone apps don't need this; the web version does. Sign-in is a bearer token, not a
    // cookie, so letting any site call the API can't act as a signed-in user.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

  // Photos, already stripped of metadata. Names are random, so they're safe to cache forever.
  app.get('/media/:key', (req, res) => {
    const file = mediaPath(req.params.key);
    if (!file || !fs.existsSync(file)) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(file);
  });

  app.use('/l', sharePageRoutes);

  const api = express.Router();
  api.use(loadUser);
  api.use('/auth', authRoutes);
  api.use('/me', meRoutes);
  api.use('/users', userRoutes);
  api.use('/places', placeRoutes);
  api.use('/reviews', reviewRoutes);
  api.use('/photos', photoRoutes);
  api.use('/comments', commentRoutes);
  api.use('/feed', feedRoutes);
  api.use('/lists', listRoutes);
  api.use('/shared-lists', sharedListRoutes);
  api.use('/reports', reportRoutes);
  api.use('/admin', adminRoutes);
  api.use('/content', contentRoutes);
  api.use(() => {
    throw notFound();
  });
  app.use('/api', api);

  app.use(errorHandler);
  return app;
}
