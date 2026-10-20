// Fills an empty database with made-up places and reviews in Da Nang and Hoi An,
// so the app has something to show while you try it. Every name here is invented.
// Never run against the live database: it refuses unless the database is empty of places.
import { foldForSearch } from '../../shared';
import { hashPassword } from './auth';
import { one, pool, q } from './db';
import { migrate } from './migrate';
import { placeSearchText } from './routes/places';

const allWeek = (open: string, close: string) =>
  Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [[open, close]]]));

const PLACES = [
  { name: 'Bánh Mì Cô Mẫu (sample)', category: 'street_food', lat: 16.0678, lng: 108.2208, city: 'da_nang', neighbourhood: 'Hải Châu', hours: allWeek('06:00', '11:00') },
  { name: 'Mì Quảng Ếch Ba Lúa (sample)', category: 'restaurant', lat: 16.0612, lng: 108.2166, city: 'da_nang', neighbourhood: 'Hải Châu', hours: allWeek('06:30', '14:00') },
  { name: 'Ốc Đêm Sơn Trà (sample)', category: 'street_food', lat: 16.0745, lng: 108.2398, city: 'da_nang', neighbourhood: 'Sơn Trà', hours: allWeek('16:00', '23:30') },
  { name: 'Sky High Rooftop (sample)', category: 'rooftop', lat: 16.0590, lng: 108.2470, city: 'da_nang', neighbourhood: 'Mỹ Khê', hours: allWeek('17:00', '01:00') },
  { name: 'Cà Phê Muối Nhà Gỗ (sample)', category: 'cafe', lat: 16.0544, lng: 108.2022, city: 'da_nang', neighbourhood: 'Thanh Khê', hours: allWeek('06:00', '22:00') },
  { name: 'Cơm Gà Bà Tám (sample)', category: 'restaurant', lat: 15.8789, lng: 108.3305, city: 'hoi_an', neighbourhood: 'Phố Cổ', hours: allWeek('10:00', '21:00') },
  { name: 'Cao Lầu Góc Phố (sample)', category: 'street_food', lat: 15.8771, lng: 108.3268, city: 'hoi_an', neighbourhood: 'Phố Cổ', hours: null },
  { name: 'Lantern Lane Bar (sample)', category: 'bar', lat: 15.8768, lng: 108.3291, city: 'hoi_an', neighbourhood: 'An Hội', hours: allWeek('15:00', '02:00') },
  { name: 'Tiệm Bánh Hoa Cau (sample)', category: 'bakery', lat: 15.8823, lng: 108.3350, city: 'hoi_an', neighbourhood: 'Cẩm Phô', hours: allWeek('07:00', '19:00') },
  { name: 'Chè Bà Út (sample)', category: 'dessert', lat: 15.8801, lng: 108.3320, city: 'hoi_an', neighbourhood: 'Minh An', hours: null },
] as const;

const REVIEWS: [number, number, string, string[], [string, boolean][], number][] = [
  [0, 5, 'Crackly bread, pâté with real swagger, and a chilli that fights back. Queue moves fast. Worth every single đồng.', ['late_night'], [['Bánh mì thập cẩm', true]], 1],
  [0, 4, 'Solid bánh mì. Not life-changing, but at this price I am not complaining and neither should you.', [], [['Bánh mì trứng', true]], 1],
  [1, 5, 'Frog mì Quảng. Yes, frog. Trust the process. Rich broth, peanuts, crackers, the lot. Would bring my mum.', ['good_for_groups'], [['Mì Quảng ếch', true], ['Trà đá', true]], 1],
  [2, 4, 'Plastic stools, cold beer, snails cooked six ways. The coconut ones are the move. Go hungry, go late.', ['late_night', 'outdoor_seating', 'good_for_groups'], [['Ốc hương xào bơ tỏi', true], ['Ốc len xào dừa', true]], 2],
  [3, 3, 'The view is doing a lot of heavy lifting. Cocktails are fine, prices are not. Go at sunset, have one, leave.', ['rooftop', 'happy_hour', 'card_accepted', 'english_menu', 'live_music'], [['Passionfruit mojito', false]], 3],
  [4, 4, 'Salt coffee that actually tastes like coffee. Aircon is a mercy at 2pm. Wifi strong enough for nomads.', ['aircon', 'card_accepted', 'dog_friendly'], [['Cà phê muối', true]], 1],
  [5, 5, 'Chicken rice with that turmeric glow. Papaya salad on the side is not optional. Queue at noon, it is worth it.', ['good_for_groups'], [['Cơm gà xé', true]], 1],
  [6, 4, 'Cao lầu with chewy noodles and crispy bits. No sign, no hours, just a woman and a pot. Find her.', [], [['Cao lầu', true]], 1],
  [7, 3, 'Fun, loud, cheap-ish buckets. Not a place for conversation. Happy hour 5 to 7 is the only sensible time.', ['happy_hour', 'live_music', 'late_night', 'english_menu'], [], 2],
  [8, 4, 'Bánh bao still warm at 8am. The pandan one is dangerous. Sold out by lunch, so do not dawdle.', ['vegetarian'], [['Bánh bao lá dứa', true]], 1],
  [9, 5, 'Chè for under 20k that made me rethink my life choices. Black sesame is elite. Bring cash.', ['vegetarian'], [['Chè mè đen', true], ['Chè bắp', false]], 1],
];

async function main() {
  await migrate();
  const existing = await one<{ n: number }>('SELECT count(*)::int AS n FROM places');
  if (existing!.n > 0) {
    console.log('There are already places in this database; not adding sample data.');
    return;
  }
  const hash = await hashPassword('sample-password');
  const users: number[] = [];
  for (const [name, city] of [['Sample Diner', 'da_nang'], ['Sample Critic', 'hoi_an']]) {
    const u = await one(
      `INSERT INTO users (email, password_hash, display_name, home_city, bio) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [`${name.toLowerCase().replace(' ', '.')}@example.com`, hash, name, city, 'A made-up reviewer for testing.'],
    );
    users.push(u!.id);
    for (const kind of ['want_to_try', 'date_night']) {
      await q('INSERT INTO lists (user_id, kind, share_slug) VALUES ($1, $2, $3)', [u!.id, kind, `sample-${u!.id}-${kind}`]);
    }
  }
  const placeIds: number[] = [];
  for (const p of PLACES) {
    const row = await one(
      `INSERT INTO places (name, category, lat, lng, city, neighbourhood, opening_hours, search_text, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [p.name, p.category, p.lat, p.lng, p.city, p.neighbourhood, p.hours, placeSearchText(p), users[0]],
    );
    placeIds.push(row!.id);
  }
  for (const [i, [place, rating, body, tags, dishes, bracket]] of REVIEWS.entries()) {
    const r = await one(
      `INSERT INTO reviews (place_id, user_id, rating, taste, value, service, vibe, cleanliness, body, price_bracket, tags, sponsored)
       VALUES ($1, $2, $3, $3, $4, 3, 4, 3, $5, $6, $7, false) RETURNING id`,
      [placeIds[place], users[i % 2], rating, Math.min(5, rating + 1 - bracket + 1), body, bracket, tags],
    );
    for (const [j, [name, up]] of dishes.entries()) {
      await q(
        'INSERT INTO review_dishes (review_id, name, name_search, thumbs_up, position) VALUES ($1, $2, $3, $4, $5)',
        [r!.id, name, foldForSearch(name), up, j],
      );
    }
  }
  console.log(`Added ${PLACES.length} sample places and ${REVIEWS.length} sample reviews. Sample log-in: sample.diner@example.com / sample-password`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
