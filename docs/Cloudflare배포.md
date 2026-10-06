# Cloudflare Workers + D1 + R2 운영

기존 Render 무료 웹서비스와 만료형 PostgreSQL 대신 다음 구성을 사용합니다.

- API: Cloudflare Worker `home-items-api`
- 데이터베이스: D1 `home-items-db` (SQLite 호환)
- 이미지: 기존 R2 버킷 `home-items`
- 운영 API: `https://home-items-api.season-masil.workers.dev/api/v1`

이 구성은 15분 미사용 후 서버가 정지되는 Render 무료 웹서비스의 콜드스타트가 없습니다.

## 배포

```bash
cd worker
npm install
npm run check
npm run db:remote
npm run deploy
```

`JWT_SECRET_KEY`는 저장소에 넣지 않고 Worker secret으로 관리합니다.

```bash
npx wrangler secret put JWT_SECRET_KEY
```

## 로컬 개발

```bash
cd worker
npm install
npm run db:local
npm run dev
```

## 데이터 백업

D1은 Time Travel 복구를 지원하지만, 정기적으로 SQL 덤프도 보관합니다.

```bash
npx wrangler d1 export home-items-db --remote --output home-items-backup.sql
```

백업 파일에는 개인정보가 포함될 수 있으므로 공개 저장소에 커밋하지 않습니다.

## 앱 연결

프로덕션 앱은 환경변수가 없을 때 위 Worker API를 기본 사용합니다. 다른 API를 쓸 때만 빌드 시 `VITE_API_BASE_URL`을 지정합니다.
