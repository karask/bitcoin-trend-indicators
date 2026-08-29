export interface AuthUser {
  id: string;
  email: string;
  createdAt: number;
  verifiedAt: number;
  lastLoginAt: number;
}

export interface AuthChallenge {
  id: string;
  email: string;
  codeHash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  consumedAt: number | null;
}

export interface AuthSessionUser extends AuthUser {
  sessionId: string;
  sessionExpiresAt: number;
}

export interface AuthSqlAdapter {
  first<T>(sql: string, values?: unknown[]): Promise<T | null>;
  run(sql: string, values?: unknown[]): Promise<{ changes: number }>;
}

type ChallengeRow = {
  id: string;
  email: string;
  code_hash: string;
  created_at: number;
  expires_at: number;
  attempts: number;
  consumed_at: number | null;
};

type UserRow = {
  id: string;
  email: string;
  created_at: number;
  verified_at: number;
  last_login_at: number;
};

type SessionUserRow = UserRow & { session_id: string; session_expires_at: number };

const asChallenge = (row: ChallengeRow): AuthChallenge => ({
  id: row.id,
  email: row.email,
  codeHash: row.code_hash,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  attempts: row.attempts,
  consumedAt: row.consumed_at,
});

const asUser = (row: UserRow): AuthUser => ({
  id: row.id,
  email: row.email,
  createdAt: row.created_at,
  verifiedAt: row.verified_at,
  lastLoginAt: row.last_login_at,
});

export class AuthStore {
  private readonly sql: AuthSqlAdapter;
  constructor(sql: AuthSqlAdapter) { this.sql = sql; }

  async cleanup(now: number): Promise<void> {
    await this.sql.run("DELETE FROM auth_rate_events WHERE created_at < ?", [now - 2 * 86_400_000]);
    await this.sql.run("DELETE FROM auth_challenges WHERE expires_at < ? OR (consumed_at IS NOT NULL AND consumed_at < ?)", [now - 86_400_000, now - 86_400_000]);
    await this.sql.run("DELETE FROM auth_sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)", [now - 86_400_000, now - 86_400_000]);
  }

  async rateCount(kind: string, subjectHash: string, since: number): Promise<number> {
    const row = await this.sql.first<{ count: number }>("SELECT COUNT(*) AS count FROM auth_rate_events WHERE kind=? AND subject_hash=? AND created_at>=?", [kind, subjectHash, since]);
    return Number(row?.count ?? 0);
  }

  async recordRate(kind: string, subjectHash: string, now: number): Promise<void> {
    await this.sql.run("INSERT INTO auth_rate_events (id,kind,subject_hash,created_at) VALUES (?,?,?,?)", [crypto.randomUUID(), kind, subjectHash, now]);
  }

  async reserveCodeSend(emailHash: string, ipHash: string, dayStart: number, now: number): Promise<boolean> {
    const reservation = crypto.randomUUID();
    const row = await this.sql.first<{ id: string }>(`INSERT INTO auth_rate_events (id,kind,subject_hash,created_at)
      SELECT ? || suffix,kind,subject_hash,?
      FROM (
        SELECT ':email' AS suffix,'email-send' AS kind,? AS subject_hash
        UNION ALL SELECT ':ip','ip-send',?
        UNION ALL SELECT ':global','global-send','global'
      )
      WHERE (SELECT COUNT(*) FROM auth_rate_events WHERE kind='email-send' AND subject_hash=? AND created_at>=?) < 1
        AND (SELECT COUNT(*) FROM auth_rate_events WHERE kind='email-send' AND subject_hash=? AND created_at>=?) < 3
        AND (SELECT COUNT(*) FROM auth_rate_events WHERE kind='ip-send' AND subject_hash=? AND created_at>=?) < 10
        AND (SELECT COUNT(*) FROM auth_rate_events WHERE kind='global-send' AND subject_hash='global' AND created_at>=?) < 90
      RETURNING id`, [reservation, now, emailHash, ipHash, emailHash, now - 60_000, emailHash, now - 15 * 60_000, ipHash, now - 60 * 60_000, dayStart]);
    return Boolean(row);
  }

  async reserveVerificationAttempt(ipHash: string, now: number): Promise<boolean> {
    const row = await this.sql.first<{ id: string }>(`INSERT INTO auth_rate_events (id,kind,subject_hash,created_at)
      SELECT ?,'ip-verify',?,?
      WHERE (SELECT COUNT(*) FROM auth_rate_events WHERE kind='ip-verify' AND subject_hash=? AND created_at>=?) < 20
      RETURNING id`, [crypto.randomUUID(), ipHash, now, ipHash, now - 60 * 60_000]);
    return Boolean(row);
  }

  async invalidateChallenges(email: string, now: number): Promise<void> {
    await this.sql.run("UPDATE auth_challenges SET consumed_at=? WHERE email=? AND consumed_at IS NULL", [now, email]);
  }

  async createChallenge(challenge: AuthChallenge): Promise<void> {
    await this.sql.run("INSERT INTO auth_challenges (id,email,code_hash,created_at,expires_at,attempts,consumed_at) VALUES (?,?,?,?,?,?,?)", [challenge.id, challenge.email, challenge.codeHash, challenge.createdAt, challenge.expiresAt, challenge.attempts, challenge.consumedAt]);
  }

  async challenge(id: string): Promise<AuthChallenge | null> {
    const row = await this.sql.first<ChallengeRow>("SELECT id,email,code_hash,created_at,expires_at,attempts,consumed_at FROM auth_challenges WHERE id=?", [id]);
    return row ? asChallenge(row) : null;
  }

  async incrementChallengeAttempts(id: string): Promise<number | null> {
    const row = await this.sql.first<{ attempts: number }>("UPDATE auth_challenges SET attempts=attempts+1 WHERE id=? AND consumed_at IS NULL RETURNING attempts", [id]);
    return row ? Number(row.attempts) : null;
  }

  async consumeChallenge(id: string, now: number): Promise<boolean> {
    const row = await this.sql.first<{ id: string }>("UPDATE auth_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>? AND attempts<? RETURNING id", [now, id, now, 5]);
    return Boolean(row);
  }

  async getOrCreateUser(email: string, now: number): Promise<AuthUser> {
    const proposedId = crypto.randomUUID();
    await this.sql.run("INSERT OR IGNORE INTO auth_users (id,email,created_at,verified_at,last_login_at) VALUES (?,?,?,?,?)", [proposedId, email, now, now, now]);
    await this.sql.run("UPDATE auth_users SET last_login_at=? WHERE email=?", [now, email]);
    const row = await this.sql.first<UserRow>("SELECT id,email,created_at,verified_at,last_login_at FROM auth_users WHERE email=?", [email]);
    if (!row) throw new Error("Unable to create the verified account");
    return asUser(row);
  }

  async createSession(userId: string, tokenHash: string, now: number, expiresAt: number): Promise<string> {
    const id = crypto.randomUUID();
    await this.sql.run("INSERT INTO auth_sessions (id,user_id,token_hash,created_at,expires_at,revoked_at) VALUES (?,?,?,?,?,NULL)", [id, userId, tokenHash, now, expiresAt]);
    await this.sql.run("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND id NOT IN (SELECT id FROM auth_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 10)", [now, userId, userId, now]);
    return id;
  }

  async sessionUser(tokenHash: string, now: number): Promise<AuthSessionUser | null> {
    const row = await this.sql.first<SessionUserRow>("SELECT u.id,u.email,u.created_at,u.verified_at,u.last_login_at,s.id AS session_id,s.expires_at AS session_expires_at FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?", [tokenHash, now]);
    return row ? { ...asUser(row), sessionId: row.session_id, sessionExpiresAt: row.session_expires_at } : null;
  }

  async revokeSession(tokenHash: string, now: number): Promise<void> {
    await this.sql.run("UPDATE auth_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL", [now, tokenHash]);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.sql.first<{ email: string }>("SELECT email FROM auth_users WHERE id=?", [userId]);
    if (!user) return;
    await this.sql.run("DELETE FROM auth_sessions WHERE user_id=?", [userId]);
    await this.sql.run("DELETE FROM auth_challenges WHERE email=?", [user.email]);
    await this.sql.run("DELETE FROM auth_users WHERE id=?", [userId]);
  }
}
