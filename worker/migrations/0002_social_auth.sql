-- 소셜 로그인(구글·카카오) 전용으로 전환합니다.
-- 카카오는 이메일 동의항목이 심사 대상이라 이메일을 식별자로 쓸 수 없습니다.
-- 따라서 users.email / password_hash 를 선택값으로 바꾸고,
-- 실제 식별은 auth_identities(provider, provider_user_id) 로 합니다.

PRAGMA defer_foreign_keys = true;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,              -- 제공자가 주지 않으면 NULL. UNIQUE 는 NULL 중복을 허용한다.
  password_hash TEXT,             -- 소셜 전용 계정은 NULL
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (id, email, password_hash, name, created_at, updated_at)
  SELECT id, email, password_hash, name, created_at, updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- 한 사용자가 구글·카카오를 모두 연결해도 계정 하나로 묶인다.
CREATE TABLE auth_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,         -- 'google' | 'kakao'
  provider_user_id TEXT NOT NULL, -- 구글 sub / 카카오 id
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_auth_identities_user ON auth_identities(user_id);

-- OAuth state 와 PKCE code_verifier 임시 보관. 콜백에서 1회 사용 후 삭제한다.
CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL     -- epoch seconds
);
