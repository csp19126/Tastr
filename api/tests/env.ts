import os from 'node:os';
import path from 'node:path';

// Must run before the app's config is imported.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/tastr_test';
process.env.ADMIN_EMAILS = 'boss@example.com';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'tastr-test-uploads');
process.env.PUBLIC_URL = 'http://api.test';
process.env.GOOGLE_CLIENT_IDS = 'test-google-client';
process.env.APPLE_BUNDLE_IDS = 'com.tastr.test';
process.env.AUTH_ATTEMPTS_PER_15_MIN = '100000';

// A stand-in for the built web app, so the tests can check it's served.
import fs from 'node:fs';
const webDir = path.join(os.tmpdir(), 'tastr-test-web');
fs.mkdirSync(webDir, { recursive: true });
fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><title>Tastr web</title>');
process.env.WEB_DIR = webDir;
