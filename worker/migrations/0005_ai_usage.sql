-- 사진 읽기(AI) 사용 횟수. 사용자별 · 날짜(UTC)별로 한 줄씩 쌓고, 하루 한도를 넘으면 더 읽지 않는다.
-- Workers AI 무료 한도가 UTC 자정에 초기화되므로 날짜도 UTC 로 센다.
CREATE TABLE ai_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
