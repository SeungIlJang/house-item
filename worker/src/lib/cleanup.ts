import type { Row } from '../types.ts'

// ──────────────────────────────────────────────────────────────
// R2 사진 정리
//
// DB 의 ON DELETE CASCADE 는 item_images 행만 지우고 R2 파일은 남긴다.
// 그래서 지우기 전에 object_key 를 모아 두었다가 DB 삭제가 끝난 뒤 R2 에서 지운다.
// 순서를 반대로 하면 DB 삭제가 실패했을 때 화면에 깨진 사진이 남는다.
// R2 삭제가 실패해도 사용자 요청은 이미 끝났으므로 로그만 남긴다(남은 파일은 비용만 든다).
// ──────────────────────────────────────────────────────────────

export const R2_DELETE_BATCH = 1000

export const deleteObjects = async (bucket: R2Bucket, keys: string[]) => {
  try {
    for (let i = 0; i < keys.length; i += R2_DELETE_BATCH) await bucket.delete(keys.slice(i, i + R2_DELETE_BATCH))
  } catch (error) {
    console.error('R2 정리 실패', keys.length, error)
  }
}

export const imageKeys = async (db: D1Database, where: string, value: number) => {
  const { results } = await db.prepare(`SELECT ii.object_key FROM item_images ii JOIN items i ON i.id=ii.item_id WHERE ${where}`).bind(value).all<Row>()
  return results.map((r) => String(r.object_key))
}

/** 사용자 폴더(items/{userId}/) 아래 파일을 모두 지운다. DB 에 기록되지 않은 고아 파일까지 정리된다. */
export const deleteUserObjects = async (bucket: R2Bucket, userId: number) => {
  try {
    let cursor: string | undefined
    do {
      const page = await bucket.list({ prefix: `items/${userId}/`, cursor, limit: R2_DELETE_BATCH })
      if (page.objects.length) await bucket.delete(page.objects.map((o) => o.key))
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
  } catch (error) {
    console.error('R2 사용자 폴더 정리 실패', userId, error)
  }
}

/**
 * 카카오는 회원 탈퇴 시 앱 연결 끊기(unlink)를 요구한다. 사용자 토큰을 보관하지 않으므로
 * 어드민 키로 끊는다. 키(KAKAO_ADMIN_KEY)가 없으면 건너뛴다. 실패해도 탈퇴는 진행한다.
 */
export const unlinkKakao = async (adminKey: string | undefined, kakaoUserIds: string[]) => {
  if (!adminKey) return
  for (const id of kakaoUserIds) {
    try {
      const res = await fetch('https://kapi.kakao.com/v1/user/unlink', {
        method: 'POST',
        headers: { Authorization: `KakaoAK ${adminKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ target_id_type: 'user_id', target_id: id }),
      })
      if (!res.ok) console.error('카카오 연결 끊기 실패', res.status)
    } catch (error) {
      console.error('카카오 연결 끊기 실패', error)
    }
  }
}
