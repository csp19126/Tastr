-- "Forgot password": a 6-digit code emailed to the account, good for 15 minutes and 5 tries.
-- Only a hash of the code is stored.
CREATE TABLE password_resets (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   smallint NOT NULL DEFAULT 0,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user ON password_resets(user_id, created_at DESC);
