-- 웹에서 시작한 소셜 로그인의 복귀 주소. 앱 로그인은 NULL(APP_REDIRECT_URI 사용).
-- /start 에서 WEB_REDIRECT_URIS 허용 목록으로 검증한 값만 저장한다.
ALTER TABLE oauth_states ADD COLUMN return_to TEXT;
