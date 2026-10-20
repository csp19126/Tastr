import sharp from 'sharp';
import request from 'supertest';

import { createApp } from '../src/app';
import { migrate } from '../src/migrate';

export const app = createApp();
let migrated: Promise<void> | undefined;
export const ready = () => (migrated ??= migrate());

let n = 0;
export async function signUp(over: Record<string, unknown> = {}) {
  n += 1;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `user${n}-${Date.now()}@example.com`, password: 'correct horse', displayName: `Eater ${n}`, ...over });
  if (res.status !== 201) throw new Error(`sign up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export async function jpeg(width = 400, height = 300, withExtras = false) {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } }).jpeg();
  if (withExtras) {
    img = img.withExif({ IFD0: { Make: 'SpyCam', Model: 'Tracker 9000', Copyright: 'secret' } }).withMetadata({ orientation: 6 });
  }
  return img.toBuffer();
}

let placeN = 0;
export async function addPlace(auth: Record<string, string>, over: Record<string, unknown> = {}) {
  placeN += 1;
  const res = await request(app)
    .post('/api/places')
    .set(auth)
    .send({ name: `Test Place ${placeN}`, category: 'restaurant', lat: 16.06 + placeN * 0.01, lng: 108.22, city: 'da_nang', ...over });
  if (res.status !== 201) throw new Error(`add place failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export const goodBody = 'Proper crispy, proper cheap, and the sauce had a kick that made me forget my own name.';

export async function addReview(auth: Record<string, string>, placeId: number, over: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/reviews')
    .set(auth)
    .send({ placeId, rating: 4, body: goodBody, sponsored: false, ...over });
  if (res.status !== 201) throw new Error(`add review failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}
