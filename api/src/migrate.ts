import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CONTENT } from './content-defaults';
import { pool } from './db';

/** Finds migrations/ whether we run from src/ (dev) or dist/ (production). */
function migrationsDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const dir of [path.join(here, '..', 'migrations'), path.join(process.cwd(), 'migrations')]) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error('migrations folder not found');
}

/** Applies any new .sql files in order, each in its own transaction. Safe to run on every start. */
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const dir = migrationsDir();
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`migrated ${file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    // Placeholder About / Terms / Privacy text, only where nothing has been written yet.
    for (const c of DEFAULT_CONTENT) {
      await client.query(
        'INSERT INTO app_content (key, language, title, body) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [c.key, c.language, c.title, c.body],
      );
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {});
    client.release();
  }
}
