CREATE TABLE IF NOT EXISTS auth_allowlist (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_allowlist_single_admin
  ON auth_allowlist (role) WHERE role = 'admin';

INSERT OR IGNORE INTO auth_allowlist (email, role, created_at)
  VALUES ('kkarasavvas@gmail.com', 'admin', 0);

-- Removing access also invalidates credentials so re-adding an email cannot revive them.
CREATE TRIGGER IF NOT EXISTS auth_allowlist_revoke
AFTER DELETE ON auth_allowlist
BEGIN
  DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM auth_users WHERE email = OLD.email);
  DELETE FROM auth_challenges WHERE email = OLD.email;
END;

-- Existing accounts are not automatically approved. Discard their old credentials.
DELETE FROM auth_sessions WHERE user_id IN (
  SELECT id FROM auth_users WHERE email NOT IN (SELECT email FROM auth_allowlist)
);
DELETE FROM auth_challenges WHERE email NOT IN (SELECT email FROM auth_allowlist);
