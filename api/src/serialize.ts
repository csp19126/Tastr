// Turns database rows into the JSON the app reads. Batches the extra lookups
// (photos, dishes, votes) so a page of 20 reviews is a handful of queries, not hundreds.

import { q } from './db';
import { mediaUrl } from './media';

export function publicUser(u: { id: number; display_name: string; photo_key: string | null; home_city?: string }) {
  return { id: u.id, displayName: u.display_name, photoUrl: mediaUrl(u.photo_key), homeCity: u.home_city };
}

/** Columns every review query selects; pass the WHERE/ORDER/LIMIT after it. */
export const REVIEW_SELECT = `
  SELECT r.*, u.display_name, u.photo_key, u.home_city, u.banned_at AS author_banned_at,
         p.hidden_at AS place_hidden_at,
         p.name AS place_name, p.category AS place_category, p.city AS place_city,
         (SELECT count(*)::int FROM helpful_votes h WHERE h.review_id = r.id) AS helpful_count,
         (SELECT count(*)::int FROM comments c JOIN users cu ON cu.id = c.user_id
            WHERE c.review_id = r.id AND c.hidden_at IS NULL AND cu.banned_at IS NULL) AS comment_count
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  JOIN places p ON p.id = r.place_id`;

/** Only what everyone may see. */
export const REVIEW_VISIBLE = `r.hidden_at IS NULL AND u.banned_at IS NULL AND p.hidden_at IS NULL`;

export async function serializeReviews(rows: any[], viewerId?: number) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [photos, dishes, votes, replies] = await Promise.all([
    q(
      `SELECT id, review_id, storage_key, width, height FROM photos
       WHERE review_id = ANY($1) AND hidden_at IS NULL ORDER BY position, id`,
      [ids],
    ),
    q(`SELECT * FROM review_dishes WHERE review_id = ANY($1) ORDER BY position, id`, [ids]),
    viewerId
      ? q(`SELECT review_id FROM helpful_votes WHERE review_id = ANY($1) AND user_id = $2`, [ids, viewerId])
      : Promise.resolve([]),
    q(
      `SELECT rr.review_id, rr.body, rr.created_at, b.name AS business_name
       FROM review_replies rr JOIN businesses b ON b.id = rr.business_id
       WHERE rr.review_id = ANY($1) AND rr.hidden_at IS NULL`,
      [ids],
    ),
  ]);
  const voted = new Set(votes.map((v) => v.review_id));
  const photo = (p: any) => ({ id: p.id, url: mediaUrl(p.storage_key), width: p.width, height: p.height });
  const photoById = new Map(photos.map((p) => [p.id, p]));
  // Dish photos are shown with their dish, not repeated in the main gallery.
  const dishPhotoIds = new Set(dishes.map((d) => d.photo_id).filter(Boolean));

  return rows.map((r) => ({
    id: r.id,
    place: { id: r.place_id, name: r.place_name, category: r.place_category, city: r.place_city },
    author: publicUser({ id: r.user_id, display_name: r.display_name, photo_key: r.photo_key, home_city: r.home_city }),
    rating: r.rating,
    ratings: { taste: r.taste, value: r.value, service: r.service, vibe: r.vibe, cleanliness: r.cleanliness },
    body: r.body,
    pricePaid: r.price_paid,
    currency: r.currency,
    priceBracket: r.price_bracket,
    tags: r.tags,
    sponsored: r.sponsored,
    visitedOn: r.visited_on ? toDateString(r.visited_on) : null,
    photos: photos.filter((p) => p.review_id === r.id && !dishPhotoIds.has(p.id)).map(photo),
    dishes: dishes
      .filter((d) => d.review_id === r.id)
      .map((d) => ({
        id: d.id,
        name: d.name,
        thumbsUp: d.thumbs_up,
        note: d.note,
        photo: d.photo_id && photoById.has(d.photo_id) ? photo(photoById.get(d.photo_id)) : null,
      })),
    helpfulCount: r.helpful_count,
    votedHelpful: voted.has(r.id),
    commentCount: r.comment_count,
    reply: (() => {
      const rep = replies.find((x) => x.review_id === r.id);
      return rep ? { businessName: rep.business_name, body: rep.body, createdAt: rep.created_at } : null;
    })(),
    hidden: !!r.hidden_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function toDateString(d: Date | string) {
  if (typeof d === 'string') return d.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
