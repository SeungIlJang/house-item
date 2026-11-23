// 내가 등록한 물건의 전체 개수. 하단 탭의 숫자 표시와 신규 사용자 광고 유예 판정이 함께 쓴다.
// 로그인 직후와 물건을 등록·삭제한 뒤에 다시 불러온다. 아직 모르면 null.
import { ref } from 'vue'
import { itemApi } from '@/api'

export const itemCount = ref<number | null>(null)

export function reportItemCount(count: number | null): void {
  itemCount.value = count
}

/** 서버에서 전체 개수를 다시 불러온다. 실패하면 이전 값을 그대로 둔다. */
export async function refreshItemCount(): Promise<void> {
  try {
    const page = await itemApi.list(1, 1)
    itemCount.value = page.totalElements
  } catch {
    // 숫자 표시가 잠깐 틀려도 앱 사용에는 지장이 없다.
  }
}

/** 탭에 붙이는 숫자 표시. 0개거나 모르면 표시하지 않고, 너무 크면 줄여 쓴다. */
export function formatBadge(count: number | null): string {
  if (!count || count < 1) return ''
  return count > 999 ? '999+' : String(count)
}
