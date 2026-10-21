-- Facebook sign-in. The id is Facebook's per-app id for that person, not their profile id.
ALTER TABLE users ADD COLUMN facebook_sub text UNIQUE;
