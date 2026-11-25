// 물건 사진에서 이름과 유통기한 읽기.
//
// 사진을 작게 줄여 서버로 보내면 서버가 AI(Cloudflare Workers AI)로 읽어 돌려준다.
// 읽기는 "도와주는 기능"이라 실패해도(한도 초과, 통신 오류, 읽을 게 없음) 조용히 null 을 돌려준다.
// 읽은 값은 저장하지 않고 화면의 빈 칸에만 채우며, 사용자가 확인하고 고칠 수 있다.
import { visionApi, type LabelRead } from '@/api'
import { compressImage } from '@/services/imageCompress'

/** 읽기용 사진의 긴 변. 날짜 각인을 읽기에 충분하고, 전송량과 AI 사용량을 줄인다. */
const READ_MAX_SIDE = 1024

/** 사용자의 오늘 날짜 'YYYY-MM-DD'. 연도가 없는 날짜("11.23")의 연도를 정하는 기준이 된다. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export async function readLabel(file: File): Promise<LabelRead | null> {
  try {
    const small = await compressImage(file, READ_MAX_SIDE)
    const result = await visionApi.readLabel(small, localToday())
    return result.name || result.expirationDate || result.dateText ? result : null
  } catch {
    return null
  }
}

/** 'YYYY-MM-DD' → '2026년 11월 23일' */
export function formatKoreanDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}
