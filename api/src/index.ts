import { config } from './config';
import { createApp } from './app';
import { pool, q } from './db';
import { deletePhotoFiles } from './media';
import { migrate } from './migrate';

if (!config.databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env (or set it on your host).');
  process.exit(1);
}

await migrate();

/** Photos uploaded for a review that was never posted are cleared after two days. */
async function sweepAbandonedPhotos() {
  const rows = await q<{ storage_key: string }>(
    `DELETE FROM photos WHERE review_id IS NULL AND place_id IS NULL AND created_at < now() - interval '2 days'
     RETURNING storage_key`,
  );
  await deletePhotoFiles(rows.map((r) => r.storage_key));
}
setInterval(() => sweepAbandonedPhotos().catch(console.error), 3_600_000).unref();

const server = createApp().listen(config.port, () => {
  console.log(`Tastr API listening on :${config.port}`);
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
