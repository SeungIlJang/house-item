// 마지막으로 물건을 등록한 보관 위치. 같은 곳의 물건을 연달아 등록할 때 매번 고르지 않도록 다음 등록 화면에 미리 채운다.
// 기기에만 저장하며, 로그아웃하면 지운다(다른 계정의 집 ID 가 남지 않게).
const KEY = 'home_items_last_place'

export type LastPlace = { homeId: number; roomId: number; storageLocationId: number | null }

export function getLastPlace(): LastPlace | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!Number.isInteger(value?.homeId) || !Number.isInteger(value?.roomId)) return null
    return {
      homeId: value.homeId,
      roomId: value.roomId,
      storageLocationId: Number.isInteger(value.storageLocationId) ? value.storageLocationId : null,
    }
  } catch {
    return null
  }
}

export function saveLastPlace(place: LastPlace): void {
  localStorage.setItem(KEY, JSON.stringify(place))
}

export function forgetLastPlace(): void {
  localStorage.removeItem(KEY)
}
