-- 유통기한 임박 목록(홈 화면, 알림 예약)을 사용자별로 빠르게 찾기 위한 인덱스.
CREATE INDEX IF NOT EXISTS idx_items_user_expiration ON items(user_id, expiration_date);
