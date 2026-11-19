// 새로 가입한 사용자에게 기본으로 만들어 주는 집과 보관장소.
// 가입 직후 바로 물건을 등록할 수 있게 하기 위한 것으로, 사용자가 자유롭게 고치거나 지울 수 있다.
export const DEFAULT_HOME_NAME = '우리집'
export const DEFAULT_ROOMS = ['거실', '주방', '안방', '작은방', '화장실', '베란다', '현관']

/** 기본 집과 보관장소를 만든다. 실패해도 가입은 진행되도록 호출하는 쪽에서 오류를 삼킨다. */
export const createDefaultHome = async (db: D1Database, userId: number) => {
  const home = await db.prepare('INSERT INTO homes(user_id,name) VALUES(?,?) RETURNING id').bind(userId, DEFAULT_HOME_NAME).first<{ id: number }>()
  if (!home) return
  await db.batch(DEFAULT_ROOMS.map((name, index) =>
    db.prepare('INSERT INTO rooms(home_id,name,sort_order) VALUES(?,?,?)').bind(home.id, name, index)))
}
