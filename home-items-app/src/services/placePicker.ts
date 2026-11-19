// 물건 등록 중 보관장소(방)를 새로 만들고 돌아왔을 때, 방금 만든 곳을 자동으로 선택하기 위한 전달 통로.
// 화면 간에 잠깐만 쓰므로 sessionStorage 에 두고, 읽으면 바로 지운다.
const KEY = 'home_items_picked_room'

export type PickedRoom = { homeId: number; roomId: number }

export function rememberPickedRoom(picked: PickedRoom): void {
  sessionStorage.setItem(KEY, JSON.stringify(picked))
}

export function takePickedRoom(): PickedRoom | null {
  const raw = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  try {
    const value = JSON.parse(raw ?? 'null')
    return Number.isInteger(value?.homeId) && Number.isInteger(value?.roomId) ? value : null
  } catch {
    return null
  }
}
