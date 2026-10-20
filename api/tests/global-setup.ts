import pg from 'pg';

/** Starts every run from an empty database. Refuses anything that doesn't look like a test database. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/tastr_test';
  if (!/test/.test(new URL(url).pathname)) throw new Error(`Refusing to wipe ${url}: database name must contain "test"`);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
}
