-- Tastr: the whole data model for version 1, plus the business side (used later).
--
-- Ground rule for businesses, enforced by design: there is NO rating stored on a place.
-- Every average is calculated from visible reviews at read time, and businesses have
-- no table, column or endpoint that can write to reviews. They can only reply.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------- people
CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  email         text UNIQUE,                 -- lower-cased; null for Apple users who hid it
  password_hash text,                        -- null for Google/Apple-only accounts
  google_sub    text UNIQUE,
  apple_sub     text UNIQUE,
  display_name  text NOT NULL,
  photo_key     text,                        -- profile picture in the media store
  home_city     text NOT NULL DEFAULT 'da_nang',
  bio           text NOT NULL DEFAULT '',
  language      text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'vi')),
  currency      text NOT NULL DEFAULT 'VND',
  notify_follows   boolean NOT NULL DEFAULT true,
  notify_comments  boolean NOT NULL DEFAULT true,
  notify_helpful   boolean NOT NULL DEFAULT true,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  banned_at     timestamptz,
  ban_reason    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,               -- sha256 of the bearer token; the token itself is never stored
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE follows (
  follower_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee ON follows(followee_id);

-- ---------------------------------------------------------------- places
CREATE TABLE places (
  id            bigserial PRIMARY KEY,
  name          text NOT NULL,
  category      text NOT NULL,
  lat           double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng           double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  address       text NOT NULL DEFAULT '',
  neighbourhood text NOT NULL DEFAULT '',
  city          text NOT NULL DEFAULT 'da_nang',
  timezone      text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  opening_hours jsonb,                       -- null = nobody knows yet (common for street stalls)
  phone         text NOT NULL DEFAULT '',
  zalo          text NOT NULL DEFAULT '',
  search_text   text NOT NULL,               -- accent-folded name + address + neighbourhood
  created_by    bigint REFERENCES users(id) ON DELETE SET NULL,
  hidden_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX places_geo ON places(lat, lng);
CREATE INDEX places_search ON places USING gin (search_text gin_trgm_ops);
CREATE INDEX places_city ON places(city);

-- ---------------------------------------------------------------- reviews
CREATE TABLE reviews (
  id            bigserial PRIMARY KEY,
  place_id      bigint NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  taste         smallint CHECK (taste BETWEEN 1 AND 5),
  value         smallint CHECK (value BETWEEN 1 AND 5),
  service       smallint CHECK (service BETWEEN 1 AND 5),
  vibe          smallint CHECK (vibe BETWEEN 1 AND 5),
  cleanliness   smallint CHECK (cleanliness BETWEEN 1 AND 5),
  body          text NOT NULL,
  price_paid    numeric(14, 2) CHECK (price_paid >= 0),
  currency      text NOT NULL DEFAULT 'VND',
  price_bracket smallint CHECK (price_bracket BETWEEN 1 AND 4),
  tags          text[] NOT NULL DEFAULT '{}',
  sponsored     boolean NOT NULL DEFAULT false,   -- "a business paid me or gave me something free"
  visited_on    date,
  hidden_at     timestamptz,
  hidden_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_place ON reviews(place_id, created_at DESC);
CREATE INDEX reviews_user ON reviews(user_id, created_at DESC);
CREATE INDEX reviews_recent ON reviews(created_at DESC);

CREATE TABLE photos (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id  bigint REFERENCES reviews(id) ON DELETE CASCADE,  -- null until the review is posted
  place_id   bigint REFERENCES places(id) ON DELETE CASCADE,   -- business photos (later) have no review
  storage_key text NOT NULL UNIQUE,
  width      int NOT NULL,
  height     int NOT NULL,
  position   smallint NOT NULL DEFAULT 0,
  hidden_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photos_review ON photos(review_id, position);
CREATE INDEX photos_place ON photos(place_id);

CREATE TABLE review_dishes (
  id          bigserial PRIMARY KEY,
  review_id   bigint NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  name        text NOT NULL,
  name_search text NOT NULL,                 -- accent-folded, so "bun cha" finds "bún chả"
  thumbs_up   boolean NOT NULL,
  note        text NOT NULL DEFAULT '',
  photo_id    bigint REFERENCES photos(id) ON DELETE SET NULL,
  position    smallint NOT NULL DEFAULT 0
);
CREATE INDEX review_dishes_review ON review_dishes(review_id);
CREATE INDEX review_dishes_search ON review_dishes USING gin (name_search gin_trgm_ops);

CREATE TABLE helpful_votes (
  review_id  bigint NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE TABLE comments (
  id         bigserial PRIMARY KEY,
  review_id  bigint NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  hidden_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_review ON comments(review_id, created_at);
CREATE INDEX comments_user ON comments(user_id, created_at DESC);

-- ---------------------------------------------------------------- lists
CREATE TABLE lists (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'custom' CHECK (kind IN ('want_to_try', 'date_night', 'custom')),
  name       text NOT NULL DEFAULT '',       -- empty for the built-in lists; the app translates their name
  share_slug text NOT NULL UNIQUE,           -- the bit after /l/ in a share link
  is_shared  boolean NOT NULL DEFAULT false, -- off = only the owner can open it
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lists_user ON lists(user_id);

CREATE TABLE list_items (
  list_id  bigint NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  place_id bigint NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  note     text NOT NULL DEFAULT '',
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, place_id)
);

-- ---------------------------------------------------------------- trust and safety
CREATE TABLE reports (
  id           bigserial PRIMARY KEY,
  reporter_id  bigint REFERENCES users(id) ON DELETE SET NULL,
  target_type  text NOT NULL CHECK (target_type IN ('review', 'photo', 'comment', 'place', 'user')),
  target_id    bigint NOT NULL,
  reason       text NOT NULL,
  details      text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  resolved_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX reports_open ON reports(status, created_at);

CREATE TABLE moderation_log (
  id         bigserial PRIMARY KEY,
  admin_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,                  -- hide, unhide, ban, unban, dismiss, edit_content
  target_type text NOT NULL,
  target_id  bigint NOT NULL,
  note       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- editable app content (About, Terms, Privacy)
CREATE TABLE app_content (
  key        text NOT NULL,                  -- about_intro, who_runs_this_app, partnerships, terms, privacy
  language   text NOT NULL CHECK (language IN ('en', 'vi')),
  title      text NOT NULL,
  body       text NOT NULL,
  updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, language)
);

-- ---------------------------------------------------------------- business side (designed now, switched on later)
CREATE TABLE businesses (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE business_members (
  business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  PRIMARY KEY (business_id, user_id)
);

-- A business asks to manage a place page; an admin approves after checking evidence.
CREATE TABLE place_claims (
  id          bigserial PRIMARY KEY,
  place_id    bigint NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  evidence    text NOT NULL DEFAULT '',
  decided_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- At most one approved owner per place.
CREATE UNIQUE INDEX place_claims_one_owner ON place_claims(place_id) WHERE status = 'approved';

-- Businesses may answer a review, once, publicly. They can never change the review itself.
CREATE TABLE review_replies (
  review_id   bigint PRIMARY KEY REFERENCES reviews(id) ON DELETE CASCADE,
  business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  author_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  body        text NOT NULL,
  hidden_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Every change to a place's facts (hours, phone, photos), by anyone, is kept for audit.
CREATE TABLE place_edits (
  id          bigserial PRIMARY KEY,
  place_id    bigint NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id     bigint REFERENCES users(id) ON DELETE SET NULL,
  business_id bigint REFERENCES businesses(id) ON DELETE SET NULL,
  changes     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- the numbers on a place page
-- Only visible reviews by people who aren't banned count. Nothing else can move a rating.
CREATE VIEW visible_reviews AS
  SELECT r.* FROM reviews r JOIN users u ON u.id = r.user_id
  WHERE r.hidden_at IS NULL AND u.banned_at IS NULL;

CREATE VIEW place_stats AS
  SELECT place_id,
         count(*)::int                       AS review_count,
         round(avg(rating), 2)::float8         AS rating,
         round(avg(taste), 2)::float8        AS taste,
         round(avg(value), 2)::float8        AS value,
         round(avg(service), 2)::float8      AS service,
         round(avg(vibe), 2)::float8         AS vibe,
         round(avg(cleanliness), 2)::float8  AS cleanliness,
         round(avg(price_bracket))::int      AS price_bracket
  FROM visible_reviews GROUP BY place_id;
