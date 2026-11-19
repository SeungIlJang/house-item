import type { App, Row } from '../types.ts'
import { ok } from '../lib/http.ts'
import { userJson } from '../lib/json.ts'
import { deleteUserObjects, unlinkKakao } from '../lib/cleanup.ts'

export function registerUserRoutes(app: App) {
  app.get('/api/v1/users/me', async (c) => {
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.get('userId')).first<Row>()
    return c.json(ok(userJson(user!)))
  })

  /**
   * 회원 탈퇴. 사용자 행을 지우면 집·방·수납공간·물건·사진 기록·카테고리·태그·소셜 연결이
   * ON DELETE CASCADE 로 함께 지워진다. 사진 파일은 R2 에서 따로 지운다.
   */
  app.delete('/api/v1/users/me', async (c) => {
    const userId = c.get('userId')
    const { results } = await c.env.DB.prepare("SELECT provider_user_id FROM auth_identities WHERE user_id=? AND provider='kakao'").bind(userId).all<Row>()
    await c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(userId).run()
    c.executionCtx.waitUntil(Promise.all([
      deleteUserObjects(c.env.IMAGES, userId),
      unlinkKakao(c.env.KAKAO_ADMIN_KEY, results.map((r) => String(r.provider_user_id))),
    ]))
    return c.json(ok(null, '탈퇴가 완료되었습니다.'))
  })
}
