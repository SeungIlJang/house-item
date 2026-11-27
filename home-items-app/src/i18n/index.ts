// 화면 언어. 기기(브라우저) 언어가 한국어면 한국어, 그 밖의 언어면 모두 영어로 보여 준다.
// 앱을 켤 때 한 번 정하고, 켜져 있는 동안에는 바꾸지 않는다(기기 언어를 바꾸면 앱이 다시 시작된다).
//
// 문구는 쓰는 자리에 두 언어를 나란히 적는다: tr('전체 물건', 'All items')
// 값이 들어가는 문구는 템플릿 문자열로: tr(`${n}개`, `${n} items`)

export type Lang = 'ko' | 'en'

function detect(): Lang {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const first = (nav?.languages?.[0] ?? nav?.language ?? 'ko').toLowerCase()
  return first.startsWith('ko') ? 'ko' : 'en'
}

export const lang: Lang = detect()
export const isKorean = lang === 'ko'

/** 지금 언어에 맞는 문구를 고른다. */
export function tr(ko: string, en: string): string {
  return isKorean ? ko : en
}

/** 날짜 선택 창 등 화면 부품에 넘기는 로캘. */
export const uiLocale = isKorean ? 'ko-KR' : 'en-US'

/** 영어 복수형. plural(1, 'item') → '1 item', plural(3, 'item') → '3 items' */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
