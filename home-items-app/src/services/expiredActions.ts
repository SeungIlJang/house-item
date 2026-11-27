// 유통기한이 지난 물건을 처리하는 선택 창. 홈의 유통기한 임박 목록과 물건 상세 화면이 함께 쓴다.
//   - 다 썼어요 / 버렸어요 → 물건 삭제
//   - 새로 샀어요          → 유통기한을 새 날짜로 (구매일이 적혀 있었다면 오늘로)
//   - 유통기한 지우기       → 날짜만 비우고 물건은 그대로
import { actionSheetController, alertController, toastController } from '@ionic/vue'
import { itemApi } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { syncExpiryReminders } from '@/services/expiryReminder'
import { refreshItemCount } from '@/services/itemCount'
import { daysUntil, toLocalDateString } from '@/utils/expiry'
import type { Item, ItemPayload } from '@/types/api'

export const isExpired = (item: Pick<Item, 'expirationDate'>) => !!item.expirationDate && daysUntil(item.expirationDate) < 0

/** 처리 결과. deleted: 물건을 지웠다. updated: 날짜를 바꿨다(바뀐 물건). null: 아무것도 하지 않았다. */
export type ExpiredResult = { kind: 'deleted' } | { kind: 'updated'; item: Item } | null

async function toast(message: string, color: 'success' | 'danger') {
  const t = await toastController.create({ message, duration: 2000, color, position: 'top' })
  await t.present()
}

/** 날짜만 바꿔 저장한다. 수정 API 는 물건 전체를 받으므로 나머지 값은 그대로 다시 보낸다. */
function saveDates(item: Item, expirationDate: string | null, purchaseDate: string | null): Promise<Item> {
  const payload: ItemPayload = {
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    memo: item.memo,
    purchaseDate,
    expirationDate,
    homeId: item.homeId,
    roomId: item.roomId,
    storageLocationId: item.storageLocationId,
    categoryId: item.categoryId,
    tagIds: item.tags.map((t) => t.id),
  }
  return itemApi.update(item.id, payload)
}

/** 확인 창. 확인을 누르면 true. */
async function confirm(header: string, message: string, okText: string): Promise<boolean> {
  const alert = await alertController.create({
    header,
    message,
    buttons: [
      { text: '취소', role: 'cancel' },
      { text: okText, role: 'confirm' },
    ],
  })
  await alert.present()
  return (await alert.onDidDismiss()).role === 'confirm'
}

/** 새 유통기한을 묻는다. 취소하면 null. */
async function askNewDate(): Promise<string | null> {
  const today = toLocalDateString(new Date())
  const alert = await alertController.create({
    header: '새 유통기한',
    message: '새로 산 물건의 유통기한을 골라 주세요.',
    inputs: [{ name: 'date', type: 'date', min: today }],
    buttons: [
      { text: '취소', role: 'cancel' },
      { text: '저장', role: 'confirm' },
    ],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss()
  if (role !== 'confirm') return null
  const value = String(data?.values?.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < today) {
    await toast('오늘 이후의 날짜를 골라 주세요.', 'danger')
    return null
  }
  return value
}

/** 선택 창을 띄우고 고른 동작을 실행한다. */
export async function handleExpiredItem(item: Item): Promise<ExpiredResult> {
  const sheet = await actionSheetController.create({
    header: `${item.name || '이름 없는 물건'} · 유통기한이 지났어요`,
    buttons: [
      { text: '다 썼어요 / 버렸어요 (물건 삭제)', role: 'destructive', data: 'delete' },
      { text: '새로 샀어요 (유통기한 변경)', data: 'renew' },
      { text: '유통기한 지우기 (물건은 유지)', data: 'clear' },
      { text: '취소', role: 'cancel' },
    ],
  })
  await sheet.present()
  const action = (await sheet.onDidDismiss()).data as 'delete' | 'renew' | 'clear' | undefined

  try {
    if (action === 'delete') {
      if (!(await confirm('물건 삭제', '이 물건과 사진을 삭제할까요? 되돌릴 수 없습니다.', '삭제'))) return null
      await itemApi.remove(item.id)
      void syncExpiryReminders()
      void refreshItemCount()
      await toast('삭제되었습니다.', 'success')
      return { kind: 'deleted' }
    }
    if (action === 'renew') {
      const date = await askNewDate()
      if (!date) return null
      // 구매일을 적어 둔 물건이면 새로 산 날(오늘)로 바꾼다. 적지 않았으면 그대로 비워 둔다.
      const updated = await saveDates(item, date, item.purchaseDate ? toLocalDateString(new Date()) : null)
      void syncExpiryReminders()
      await toast('유통기한을 바꿨어요.', 'success')
      return { kind: 'updated', item: updated }
    }
    if (action === 'clear') {
      const updated = await saveDates(item, null, item.purchaseDate)
      void syncExpiryReminders()
      await toast('유통기한을 지웠어요.', 'success')
      return { kind: 'updated', item: updated }
    }
  } catch (e) {
    await toast(extractErrorMessage(e), 'danger')
  }
  return null
}
