import fs from 'node:fs';
import path from 'node:path';

import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { socialVerifier } from '../src/auth';
import { pool } from '../src/db';
import { addPlace, addReview, app, goodBody, jpeg, ready, signUp } from './helpers';

beforeAll(ready);

const uploadDir = process.env.UPLOAD_DIR!;

async function uploadPhoto(auth: Record<string, string>) {
  const res = await request(app).post('/api/photos').set(auth).attach('photo', await jpeg(), 'food.jpg');
  expect(res.status).toBe(201);
  return res.body as { id: number; url: string };
}

describe('accounts', () => {
  it('signs up, logs in, logs out', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Hungry@Example.com', password: 'banhmi4life', displayName: 'Hungry', language: 'vi' });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ email: 'hungry@example.com', language: 'vi', role: 'user', homeCity: 'da_nang' });

    const dupe = await request(app).post('/api/auth/register').send({ email: 'hungry@example.com', password: 'banhmi4life', displayName: 'x' });
    expect(dupe.status).toBe(409);
    expect(dupe.body.error).toBe('email_taken');

    const bad = await request(app).post('/api/auth/login').send({ email: 'hungry@example.com', password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({ email: ' HUNGRY@example.com ', password: 'banhmi4life' });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.token}` };
    expect((await request(app).get('/api/me').set(auth)).status).toBe(200);

    expect((await request(app).post('/api/auth/logout').set(auth)).status).toBe(200);
    expect((await request(app).get('/api/me').set(auth)).status).toBe(401);
  });

  it('starts everyone with "Want to try" and "Date night" lists', async () => {
    const { auth } = await signUp();
    const lists = (await request(app).get('/api/lists').set(auth)).body.lists;
    expect(lists.map((l: any) => l.kind)).toEqual(['date_night', 'want_to_try']);
  });

  it('makes ADMIN_EMAILS admins', async () => {
    const { user } = await signUp({ email: 'boss@example.com' });
    expect(user.role).toBe('admin');
  });

  it('updates the profile and settings', async () => {
    const { auth } = await signUp();
    const res = await request(app)
      .patch('/api/me')
      .set(auth)
      .send({ displayName: 'Pho Real', bio: 'Will queue for crab.', homeCity: 'hoi_an', language: 'vi', currency: 'USD', notifications: { helpful: false } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayName: 'Pho Real', bio: 'Will queue for crab.', homeCity: 'hoi_an', language: 'vi', currency: 'USD',
      notifications: { follows: true, comments: true, helpful: false },
    });
    expect((await request(app).patch('/api/me').set(auth).send({ homeCity: 'atlantis' })).status).toBe(400);

    const photo = await request(app).put('/api/me/photo').set(auth).attach('photo', await jpeg(), 'me.jpg');
    expect(photo.status).toBe(200);
    expect(photo.body.photoUrl).toMatch(/^http:\/\/api\.test\/media\/[a-f0-9]{32}\.jpg$/);
  });

  it('signs in with Google and links to an existing email account', async () => {
    const { user } = await signUp({ email: 'linkme@example.com' });
    const original = socialVerifier.google;
    socialVerifier.google = async (token) => {
      if (token !== 'good-google-token') throw new Error('bad');
      return { sub: 'google-123', email: 'linkme@example.com', emailVerified: true, name: 'Link Me' };
    };
    try {
      const res = await request(app).post('/api/auth/google').send({ idToken: 'good-google-token' });
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.signInMethods.sort()).toEqual(['email', 'google']);
    } finally {
      socialVerifier.google = original;
    }
  });

  it('signs up with Apple using the name the phone sends', async () => {
    const original = socialVerifier.apple;
    socialVerifier.apple = async () => ({ sub: 'apple-xyz', email: null, emailVerified: false, name: null });
    try {
      const first = await request(app).post('/api/auth/apple').send({ identityToken: 'apple-token-1', fullName: 'Quiet Diner' });
      expect(first.status).toBe(200);
      expect(first.body.user).toMatchObject({ displayName: 'Quiet Diner', email: null, signInMethods: ['apple'] });
      const again = await request(app).post('/api/auth/apple').send({ identityToken: 'apple-token-2' });
      expect(again.body.user.id).toBe(first.body.user.id);
    } finally {
      socialVerifier.apple = original;
    }
  });

  it('rejects forged Google tokens', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'eyJhbGciOiJIUzI1NiJ9.e30.forged-signature' });
    expect(res.status).toBe(401);
  });
});

describe('places', () => {
  it('adds a street stall by pin, with no website or address', async () => {
    const { auth } = await signUp();
    const p = await addPlace(auth, {
      name: 'Bánh Mì Cô Hai', category: 'street_food', lat: 15.877, lng: 108.326, city: 'hoi_an',
      openingHours: { mon: [['06:00', '11:00']] }, zalo: '0905 000 000',
    });
    expect(p).toMatchObject({ name: 'Bánh Mì Cô Hai', category: 'street_food', city: 'hoi_an', reviewCount: 0, paws: null, zalo: '0905 000 000' });
    expect(p.openingHours).toEqual({ mon: [['06:00', '11:00']] });
  });

  it('spots the same place added twice, but allows a genuinely different one', async () => {
    const { auth } = await signUp();
    const p = await addPlace(auth, { name: 'Ốc Đêm', lat: 16.1, lng: 108.25 });
    const again = await request(app).post('/api/places').set(auth).send({ name: 'oc dem', category: 'street_food', lat: 16.1003, lng: 108.2501 });
    expect(again.status).toBe(409);
    expect(again.body.place.id).toBe(p.id);
    // A longer name next door is a different place.
    expect((await request(app).post('/api/places').set(auth).send({ name: 'Ốc Đêm Bà Tư', category: 'street_food', lat: 16.1003, lng: 108.2501 })).status).toBe(201);
    // And the user can insist.
    expect((await request(app).post('/api/places').set(auth).send({ name: 'Ốc Đêm', category: 'street_food', lat: 16.1004, lng: 108.2501, allowDuplicate: true })).status).toBe(201);
  });

  it('refuses bad input', async () => {
    const { auth } = await signUp();
    const bad = [
      { name: '', category: 'cafe', lat: 16, lng: 108 },
      { name: 'X', category: 'casino', lat: 16, lng: 108 },
      { name: 'X', category: 'cafe', lat: 160, lng: 108 },
      { name: 'X', category: 'cafe', lat: 16, lng: 108, openingHours: { mon: [['late', 'later']] } },
    ];
    for (const body of bad) expect((await request(app).post('/api/places').set(auth).send(body)).status).toBe(400);
    expect((await request(app).post('/api/places').send({ name: 'X', category: 'cafe', lat: 16, lng: 108 })).status).toBe(401);
  });
});

describe('reviews', () => {
  it('posts a full review with photos, dishes, sub-ratings, price and tags', async () => {
    const { auth, user } = await signUp();
    const place = await addPlace(auth, { name: 'Mì Quảng Bà Mua' });
    const [p1, p2, dishPhoto] = [await uploadPhoto(auth), await uploadPhoto(auth), await uploadPhoto(auth)];
    const review = await addReview(auth, place.id, {
      paws: 5,
      ratings: { taste: 5, value: 5, service: 3, vibe: 4, cleanliness: 4 },
      pricePaid: 45000,
      priceBracket: 1,
      tags: ['aircon', 'good_for_groups'],
      visitedOn: '2026-10-18',
      photoIds: [p1.id, p2.id],
      dishes: [
        { name: 'Mì Quảng gà', thumbsUp: true, note: 'Broth to write home about', photoId: dishPhoto.id },
        { name: 'Trà đá', thumbsUp: false },
      ],
    });
    expect(review).toMatchObject({
      paws: 5,
      ratings: { taste: 5, value: 5, service: 3, vibe: 4, cleanliness: 4 },
      pricePaid: 45000, currency: 'VND', priceBracket: 1, sponsored: false, visitedOn: '2026-10-18',
      tags: ['aircon', 'good_for_groups'],
      author: { id: user.id },
      place: { id: place.id, name: 'Mì Quảng Bà Mua' },
    });
    expect(review.photos.map((p: any) => p.id)).toEqual([p1.id, p2.id]); // dish photo not repeated
    expect(review.dishes[0]).toMatchObject({ name: 'Mì Quảng gà', thumbsUp: true, photo: { id: dishPhoto.id } });
    expect(review.dishes[1]).toMatchObject({ name: 'Trà đá', thumbsUp: false, photo: null });

    const detail = (await request(app).get(`/api/places/${place.id}`)).body;
    expect(detail).toMatchObject({ reviewCount: 1, paws: 5, priceBracket: 1, ratings: { taste: 5, service: 3 } });
    expect(detail.popularDishes[0]).toMatchObject({ name: 'Mì Quảng gà', mentions: 1, thumbsUp: 1 });
    expect(detail.photos).toHaveLength(3);
    expect(detail.coverUrl).toMatch(/\/media\//);
  });

  it('insists on the sponsored question being answered, and labels sponsored reviews', async () => {
    const { auth } = await signUp();
    const place = await addPlace(auth);
    const missing = await request(app).post('/api/reviews').set(auth).send({ placeId: place.id, paws: 4, body: goodBody });
    expect(missing.status).toBe(400);
    const r = await addReview(auth, place.id, { sponsored: true });
    expect(r.sponsored).toBe(true);
  });

  it('will not let anyone use someone else’s photos', async () => {
    const a = await signUp();
    const b = await signUp();
    const place = await addPlace(a.auth);
    const photo = await uploadPhoto(a.auth);
    const res = await request(app).post('/api/reviews').set(b.auth).send({ placeId: place.id, paws: 3, body: goodBody, sponsored: false, photoIds: [photo.id] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_photo');
  });

  it('caps photos at 10 and asks for a real review, not one word', async () => {
    const { auth } = await signUp();
    const place = await addPlace(auth);
    const tooMany = await request(app).post('/api/reviews').set(auth).send({ placeId: place.id, paws: 3, body: goodBody, sponsored: false, photoIds: Array.from({ length: 11 }, (_, i) => i + 1) });
    expect(tooMany.status).toBe(400);
    const short = await request(app).post('/api/reviews').set(auth).send({ placeId: place.id, paws: 3, body: 'yum', sponsored: false });
    expect(short.status).toBe(400);
  });

  it('stops one account spamming: one review per place per week, 10 a day', async () => {
    const { auth } = await signUp();
    const place = await addPlace(auth);
    await addReview(auth, place.id);
    const again = await request(app).post('/api/reviews').set(auth).send({ placeId: place.id, paws: 1, body: goodBody, sponsored: false });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('reviewed_recently');

    for (let i = 0; i < 9; i++) await addReview(auth, (await addPlace(auth)).id);
    const eleventh = await request(app).post('/api/reviews').set(auth).send({ placeId: (await addPlace(auth)).id, paws: 3, body: goodBody, sponsored: false });
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.error).toBe('too_many_reviews');
  });

  it('edits a review and deletes photos the author removed', async () => {
    const { auth } = await signUp();
    const place = await addPlace(auth);
    const keep = await uploadPhoto(auth);
    const drop = await uploadPhoto(auth);
    const r = await addReview(auth, place.id, { photoIds: [keep.id, drop.id] });
    const dropFile = path.join(uploadDir, path.basename(drop.url));
    expect(fs.existsSync(dropFile)).toBe(true);

    const edited = await request(app).put(`/api/reviews/${r.id}`).set(auth).send({ paws: 2, body: `${goodBody} Went back. Not the same.`, sponsored: false, photoIds: [keep.id] });
    expect(edited.status).toBe(200);
    expect(edited.body.paws).toBe(2);
    expect(edited.body.photos.map((p: any) => p.id)).toEqual([keep.id]);
    expect(fs.existsSync(dropFile)).toBe(false);

    const other = await signUp();
    expect((await request(app).put(`/api/reviews/${r.id}`).set(other.auth).send({ paws: 5, body: goodBody, sponsored: false })).status).toBe(404);
  });

  it('counts helpful votes once each, never your own', async () => {
    const a = await signUp();
    const b = await signUp();
    const r = await addReview(a.auth, (await addPlace(a.auth)).id);
    expect((await request(app).post(`/api/reviews/${r.id}/helpful`).set(a.auth)).status).toBe(400);
    await request(app).post(`/api/reviews/${r.id}/helpful`).set(b.auth);
    const twice = await request(app).post(`/api/reviews/${r.id}/helpful`).set(b.auth);
    expect(twice.body).toMatchObject({ helpfulCount: 1, votedHelpful: true });
    const undo = await request(app).delete(`/api/reviews/${r.id}/helpful`).set(b.auth);
    expect(undo.body).toMatchObject({ helpfulCount: 0, votedHelpful: false });
  });

  it('takes comments', async () => {
    const a = await signUp();
    const b = await signUp();
    const r = await addReview(a.auth, (await addPlace(a.auth)).id);
    const c = await request(app).post(`/api/reviews/${r.id}/comments`).set(b.auth).send({ body: 'Was the crab worth it?' });
    expect(c.status).toBe(201);
    const list = await request(app).get(`/api/reviews/${r.id}/comments`);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0]).toMatchObject({ body: 'Was the crab worth it?', author: { id: b.user.id } });
    expect((await request(app).get(`/api/reviews/${r.id}`)).body.commentCount).toBe(1);
    expect((await request(app).delete(`/api/comments/${c.body.id}`).set(a.auth)).status).toBe(404); // not yours
    expect((await request(app).delete(`/api/comments/${c.body.id}`).set(b.auth)).status).toBe(200);
  });
});

describe('discover', () => {
  // Far from everything else the tests create, so results are predictable.
  const base = { lat: 10.0, lng: 105.0 };
  let ids: Record<string, number> = {};

  beforeAll(async () => {
    const { auth } = await signUp();
    const other = await signUp();
    const mk = async (name: string, over: Record<string, unknown>) => (await addPlace(auth, { name, ...over })).id;
    ids = {
      banhmi: await mk('Bánh Mì Phượng Test', { category: 'street_food', lat: base.lat + 0.001, lng: base.lng, neighbourhood: 'Phố Cổ' }),
      bar: await mk('Rooftop Ruff', { category: 'rooftop', lat: base.lat + 0.01, lng: base.lng, openingHours: { mon: [['00:00', '23:59']], tue: [['00:00', '23:59']], wed: [['00:00', '23:59']], thu: [['00:00', '23:59']], fri: [['00:00', '23:59']], sat: [['00:00', '23:59']], sun: [['00:00', '23:59']] } }),
      cafe: await mk('Cà Phê Muối Chú Long', { category: 'cafe', lat: base.lat + 0.05, lng: base.lng, openingHours: { mon: [['05:00', '05:01']] } }),
      far: await mk('Far Away Pizza', { category: 'restaurant', lat: base.lat + 1, lng: base.lng }),
    };
    await addReview(auth, ids.banhmi, { paws: 5, priceBracket: 1, tags: ['late_night'], dishes: [{ name: 'Bánh mì thập cẩm', thumbsUp: true }] });
    await addReview(other.auth, ids.banhmi, { paws: 4, priceBracket: 1 });
    await addReview(auth, ids.bar, { paws: 3, priceBracket: 3, tags: ['live_music', 'happy_hour'], dishes: [{ name: 'Bún chả', thumbsUp: true }] });
    await addReview(auth, ids.cafe, { paws: 4, priceBracket: 1, tags: ['aircon'] });
  });

  const find = (query: Record<string, unknown>) => request(app).get('/api/places').query(query);
  const names = (res: any) => res.body.places.map((p: any) => p.name);

  it('lists places near me, closest first, within a radius', async () => {
    const res = await find({ ...base, radiusKm: 10 });
    expect(names(res)).toEqual(['Bánh Mì Phượng Test', 'Rooftop Ruff', 'Cà Phê Muối Chú Long']);
    expect(res.body.places[0].distanceKm).toBeCloseTo(0.11, 1);
    expect(res.body.places[0]).toMatchObject({ paws: 4.5, reviewCount: 2, priceBracket: 1 });
  });

  it('searches with or without Vietnamese accents', async () => {
    for (const qq of ['banh mi', 'Bánh mì', 'BANH MI phuong', 'pho co']) {
      expect(names(await find({ ...base, radiusKm: 100, q: qq }))).toEqual(['Bánh Mì Phượng Test']);
    }
    expect(names(await find({ ...base, radiusKm: 100, q: 'ca phe muoi' }))).toEqual(['Cà Phê Muối Chú Long']);
  });

  it('finds places by a dish someone reviewed there', async () => {
    expect(names(await find({ ...base, radiusKm: 100, q: 'bun cha' }))).toEqual(['Rooftop Ruff']);
    expect(names(await find({ ...base, radiusKm: 100, q: 'thap cam' }))).toEqual(['Bánh Mì Phượng Test']);
  });

  it('filters by category, price, paws, tags and open now', async () => {
    const near = { ...base, radiusKm: 100 };
    expect(names(await find({ ...near, category: 'rooftop,cafe' }))).toEqual(['Rooftop Ruff', 'Cà Phê Muối Chú Long']);
    expect(names(await find({ ...near, price: '1' }))).toEqual(['Bánh Mì Phượng Test', 'Cà Phê Muối Chú Long']);
    expect(names(await find({ ...near, minPaws: 4.5 }))).toEqual(['Bánh Mì Phượng Test']);
    expect(names(await find({ ...near, tags: 'live_music,happy_hour' }))).toEqual(['Rooftop Ruff']);
    expect(names(await find({ ...near, tags: 'live_music,aircon' }))).toEqual([]);
    expect(names(await find({ ...near, openNow: 'true' }))).toEqual(['Rooftop Ruff']); // open 24/7; the others are unknown or shut
    expect(names(await find({ ...near, sort: 'paws' })).slice(0, 2)).toEqual(['Bánh Mì Phượng Test', 'Cà Phê Muối Chú Long']);
  });
});

describe('lists and sharing', () => {
  it('saves places, shares by link, and the link works without the app', async () => {
    const { auth, user } = await signUp({ displayName: 'List Maker' });
    const place = await addPlace(auth, { name: 'Date Spot <script>' });
    const lists = (await request(app).get('/api/lists').set(auth)).body.lists;
    const dateNight = lists.find((l: any) => l.kind === 'date_night');

    await request(app).post(`/api/lists/${dateNight.id}/places`).set(auth).send({ placeId: place.id, note: 'Ask for the window seat' });
    const custom = (await request(app).post('/api/lists').set(auth).send({ name: 'Hangover cures' })).body;
    await request(app).post(`/api/lists/${custom.id}/places`).set(auth).send({ placeId: place.id });

    expect((await request(app).get(`/api/places/${place.id}`).set(auth)).body.savedInLists.sort()).toEqual([dateNight.id, custom.id].sort());

    const detail = (await request(app).get(`/api/lists/${dateNight.id}`).set(auth)).body;
    expect(detail).toMatchObject({ placeCount: 1, isShared: false, shareUrl: null, places: [{ id: place.id, note: 'Ask for the window seat' }] });

    const shared = (await request(app).patch(`/api/lists/${dateNight.id}`).set(auth).send({ isShared: true })).body;
    const slug = shared.shareUrl.split('/l/')[1];
    expect(shared.shareUrl).toBe(`http://api.test/l/${slug}`);

    const pub = await request(app).get(`/api/shared-lists/${slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ owner: { id: user.id, displayName: 'List Maker' }, places: [{ id: place.id }] });

    const page = await request(app).get(`/l/${slug}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain('Date Spot &#60;script&#62;'); // escaped, not run
    expect(page.text).not.toContain('<script>');

    await request(app).patch(`/api/lists/${dateNight.id}`).set(auth).send({ isShared: false });
    expect((await request(app).get(`/api/shared-lists/${slug}`)).status).toBe(404);

    expect((await request(app).delete(`/api/lists/${dateNight.id}`).set(auth)).status).toBe(400); // built-in list stays
    expect((await request(app).delete(`/api/lists/${custom.id}`).set(auth)).status).toBe(200);
    const stranger = await signUp();
    expect((await request(app).get(`/api/lists/${dateNight.id}`).set(stranger.auth)).status).toBe(404);
  });
});

describe('follows and feed', () => {
  it('shows reviews from people I follow, and from my city', async () => {
    const me = await signUp({ homeCity: 'hue' });
    const chef = await signUp();
    const rando = await signUp();
    const huePlace = await addPlace(rando.auth, { name: 'Bún Bò Huế Test', city: 'hue' });
    const elsewhere = await addPlace(chef.auth, { city: 'da_nang' });

    const followed = await addReview(chef.auth, elsewhere.id);
    const local = await addReview(rando.auth, huePlace.id);

    expect((await request(app).post(`/api/users/${me.user.id}/follow`).set(me.auth)).status).toBe(400);
    await request(app).post(`/api/users/${chef.user.id}/follow`).set(me.auth);

    const following = (await request(app).get('/api/feed').query({ scope: 'following' }).set(me.auth)).body.reviews;
    expect(following.map((r: any) => r.id)).toEqual([followed.id]);

    const city = (await request(app).get('/api/feed').query({ scope: 'city' }).set(me.auth)).body.reviews;
    expect(city.map((r: any) => r.id)).toContain(local.id);
    expect(city.map((r: any) => r.id)).not.toContain(followed.id);

    const profile = (await request(app).get(`/api/users/${chef.user.id}`).set(me.auth)).body;
    expect(profile).toMatchObject({ followerCount: 1, reviewCount: 1, isFollowing: true });
  });
});

describe('trust and safety', () => {
  it('reports go to admins, who can hide content and ban users', async () => {
    const admin = await signUp({ email: 'boss@example.com' }).catch(async () => {
      const login = await request(app).post('/api/auth/login').send({ email: 'boss@example.com', password: 'correct horse' });
      return { auth: { Authorization: `Bearer ${login.body.token}` }, user: login.body.user, token: login.body.token };
    });
    const spammer = await signUp();
    const reporter = await signUp();
    const place = await addPlace(reporter.auth, { name: 'Honest Noodles' });
    await addReview(reporter.auth, place.id, { paws: 4 });
    const fake = await addReview(spammer.auth, place.id, { paws: 1, body: 'Terrible terrible terrible, go to my cousin’s shop instead!!!' });
    expect((await request(app).get(`/api/places/${place.id}`)).body.paws).toBe(2.5);

    // Normal users can't see the admin screen.
    expect((await request(app).get('/api/admin/reports').set(reporter.auth)).status).toBe(403);

    const report = await request(app).post('/api/reports').set(reporter.auth).send({ targetType: 'review', targetId: fake.id, reason: 'fake', details: 'Owner of the shop next door' });
    expect(report.status).toBe(201);
    // Reporting twice is harmless.
    expect((await request(app).post('/api/reports').set(reporter.auth).send({ targetType: 'review', targetId: fake.id, reason: 'spam' })).status).toBe(201);

    const queue = (await request(app).get('/api/admin/reports').set(admin.auth)).body.items;
    const item = queue.find((i: any) => i.targetType === 'review' && i.targetId === fake.id);
    expect(item).toMatchObject({ reportCount: 1, reasons: ['fake'], target: { authorId: spammer.user.id, placeName: 'Honest Noodles' } });

    const resolved = await request(app).post('/api/admin/reports/resolve').set(admin.auth).send({ targetType: 'review', targetId: fake.id, action: 'hide', banAuthor: true, note: 'competitor' });
    expect(resolved.status).toBe(200);

    // The fake review no longer counts, the spammer is signed out and can't post.
    expect((await request(app).get(`/api/places/${place.id}`)).body).toMatchObject({ paws: 4, reviewCount: 1 });
    expect((await request(app).get(`/api/reviews/${fake.id}`)).status).toBe(404);
    expect((await request(app).get('/api/me').set(spammer.auth)).status).toBe(401);
    const back = await request(app).post('/api/auth/login').send({ email: spammer.user.email, password: 'correct horse' });
    expect(back.body.user.banned).toBe(true);
    const banned = { Authorization: `Bearer ${back.body.token}` };
    const tryPost = await request(app).post('/api/reviews').set(banned).send({ placeId: place.id, paws: 1, body: goodBody, sponsored: false });
    expect(tryPost.status).toBe(403);

    expect((await request(app).get('/api/admin/reports').set(admin.auth)).body.items.find((i: any) => i.targetId === fake.id)).toBeUndefined();

    // Unban: the review is still hidden (that was a separate decision), but the account works.
    await request(app).post(`/api/admin/users/${spammer.user.id}/ban`).set(admin.auth).send({ banned: false });
    expect((await request(app).get(`/api/places/${place.id}`)).body.reviewCount).toBe(1);
    await request(app).post('/api/admin/hide').set(admin.auth).send({ targetType: 'review', targetId: fake.id, hidden: false });
    expect((await request(app).get(`/api/places/${place.id}`)).body.reviewCount).toBe(2);
  });

  it('lets admins edit the About content without a release, falling back to English', async () => {
    const admin = await request(app).post('/api/auth/login').send({ email: 'boss@example.com', password: 'correct horse' });
    const auth = { Authorization: `Bearer ${admin.body.token}` };
    const before = (await request(app).get('/api/content').query({ lang: 'vi' })).body.content;
    expect(Object.keys(before).sort()).toEqual(['about_intro', 'partnerships', 'privacy', 'terms', 'who_runs_this_app']);
    expect(before.who_runs_this_app.title).toBe('Ai vận hành ứng dụng này');

    const put = await request(app).put('/api/admin/content/partnerships/en').set(auth).send({ title: 'Partnerships and affiliations', body: 'None. Nobody pays us.' });
    expect(put.status).toBe(200);
    expect((await request(app).get('/api/content').query({ lang: 'en' })).body.content.partnerships.body).toBe('None. Nobody pays us.');
    expect((await request(app).put('/api/admin/content/secret_page/en').set(auth).send({ title: 'x', body: 'y' })).status).toBe(400);

    const nobody = await signUp();
    expect((await request(app).put('/api/admin/content/terms/en').set(nobody.auth).send({ title: 'x', body: 'y' })).status).toBe(403);
  });
});

describe('delete my account', () => {
  it('removes the account, everything posted and the photo files; places stay', async () => {
    const leaver = await signUp();
    const friend = await signUp();
    const place = await addPlace(leaver.auth, { name: 'Stays On The Map' });
    const photo = await uploadPhoto(leaver.auth);
    const r = await addReview(leaver.auth, place.id, { photoIds: [photo.id] });
    await request(app).post(`/api/reviews/${r.id}/comments`).set(leaver.auth).send({ body: 'my own comment' });
    await request(app).post(`/api/users/${friend.user.id}/follow`).set(leaver.auth);
    await request(app).post('/api/reports').set(leaver.auth).send({ targetType: 'place', targetId: place.id, reason: 'wrong_info' });
    const file = path.join(uploadDir, path.basename(photo.url));
    expect(fs.existsSync(file)).toBe(true);

    expect((await request(app).delete('/api/me').set(leaver.auth)).status).toBe(200);

    expect(fs.existsSync(file)).toBe(false);
    expect((await request(app).get('/api/me').set(leaver.auth)).status).toBe(401);
    expect((await request(app).get(`/api/reviews/${r.id}`)).status).toBe(404);
    const p = (await request(app).get(`/api/places/${place.id}`)).body;
    expect(p).toMatchObject({ name: 'Stays On The Map', reviewCount: 0, createdBy: null });
    const left = await pool.query(
      `SELECT (SELECT count(*) FROM users WHERE id = $1) + (SELECT count(*) FROM reviews WHERE user_id = $1) +
              (SELECT count(*) FROM photos WHERE user_id = $1) + (SELECT count(*) FROM comments WHERE user_id = $1) +
              (SELECT count(*) FROM follows WHERE follower_id = $1) + (SELECT count(*) FROM lists WHERE user_id = $1) +
              (SELECT count(*) FROM reports WHERE reporter_id = $1) + (SELECT count(*) FROM sessions WHERE user_id = $1) AS n`,
      [leaver.user.id],
    );
    expect(Number(left.rows[0].n)).toBe(0);
  });
});

describe('the server', () => {
  it('reports health and gives clean errors', async () => {
    expect((await request(app).get('/health')).body).toEqual({ ok: true, db: true });
    expect((await request(app).get('/api/nope')).status).toBe(404);
    expect((await request(app).get('/media/../../etc/passwd')).status).toBe(404);
    const junk = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{not json');
    expect(junk.status).toBe(400);
  });
});
