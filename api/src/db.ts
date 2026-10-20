import pg from 'pg';

import { config } from './config';

// Postgres returns bigint ids as strings; ours fit comfortably in a JS number.
pg.types.setTypeParser(20, (v) => Number(v));
// numeric (prices) as numbers too.
pg.types.setTypeParser(1700, (v) => Number(v));
// Calendar dates stay plain "YYYY-MM-DD" strings (no time-zone shifting).
pg.types.setTypeParser(1082, (v) => v);

export let pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

/** Tests point the app at a throwaway database. */
export function usePool(p: pg.Pool) {
  pool = p;
}

export type Db = Pick<pg.PoolClient, 'query'>;

export async function q<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool) {
  const res = await db.query<T>(text, params);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool) {
  const rows = await q<T>(text, params, db);
  return rows[0] as T | undefined;
}

export async function tx<T>(fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
