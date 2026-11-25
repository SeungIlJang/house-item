// 포장에 찍힌 날짜 글자("2026.11.23", "26.11.23", "11.23 10:03 D", "2027년 3월")를 'YYYY-MM-DD' 로 바꾼다.
// AI 에게는 글자를 그대로 옮겨 적게만 하고, 날짜 계산은 여기서 한다(연도 추정을 모델에 맡기면 틀린 연도를 지어낸다).

const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m)
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const SEP = '\\s*[.\\-/년월,]\\s*'

/**
 * @param text  포장에 찍힌 글자
 * @param today 사용자의 오늘 날짜 'YYYY-MM-DD'. 연도가 없는 날짜의 연도를 정하고, 터무니없는 연도를 걸러내는 데 쓴다.
 */
export function parseLabelDate(text: string, today: string): string | null {
  const [ty, tm, td] = today.split('-').map(Number)
  if (!ty || !tm || !td) return null
  // 시각(10:03, 10:03:22)은 날짜로 잘못 읽히지 않게 먼저 지운다.
  const s = text.replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ')
  const yearOk = (y: number) => y >= ty - 2 && y <= ty + 15
  let m: RegExpMatchArray | null

  // 네 자리 연도가 찍혀 있는데 범위를 벗어나면(1999 등) 뒤쪽 숫자를 월·일로 잘못 읽지 않게 여기서 끝낸다.
  const printedYear = s.match(/(?<!\d)((?:19|20)\d{2})(?!\d)/)
  if (printedYear && !yearOk(Number(printedYear[1]))) return null

  // 2026.11.23 / 2026-11-23 / 2026년 11월 23일
  if ((m = s.match(new RegExp(`(20\\d{2})${SEP}(\\d{1,2})${SEP}(\\d{1,2})`)))) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return yearOk(y) && valid(y, mo, d) ? iso(y, mo, d) : null
  }
  // 20261123
  if ((m = s.match(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/))) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (yearOk(y) && valid(y, mo, d)) return iso(y, mo, d)
  }
  // 26.11.23 (국내 표기는 연.월.일 순서)
  if ((m = s.match(new RegExp(`(?<!\\d)(\\d{2})${SEP}(\\d{1,2})${SEP}(\\d{1,2})(?!\\d)`)))) {
    const [y, mo, d] = [2000 + Number(m[1]), Number(m[2]), Number(m[3])]
    if (yearOk(y) && valid(y, mo, d)) return iso(y, mo, d)
  }
  // 261123
  if ((m = s.match(/(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/))) {
    const [y, mo, d] = [2000 + Number(m[1]), Number(m[2]), Number(m[3])]
    if (yearOk(y) && valid(y, mo, d)) return iso(y, mo, d)
  }
  // 2027.03 / 2027년 3월 → 그 달의 마지막 날
  if ((m = s.match(new RegExp(`(20\\d{2})${SEP}(\\d{1,2})(?!\\d)`)))) {
    const [y, mo] = [Number(m[1]), Number(m[2])]
    if (yearOk(y) && mo >= 1 && mo <= 12) return iso(y, mo, daysIn(y, mo))
  }
  // 11.23 / 11월 23일 → 연도가 없다. 올해로 보되, 반년 넘게 지난 날짜면 내년으로 본다.
  if ((m = s.match(new RegExp(`(?<!\\d)(\\d{1,2})${SEP}(\\d{1,2})(?!\\d)`)))) {
    const [mo, d] = [Number(m[1]), Number(m[2])]
    if (!valid(ty, mo, d)) return null
    const ageDays = (Date.UTC(ty, tm - 1, td) - Date.UTC(ty, mo - 1, d)) / 86400000
    const y = ageDays > 180 ? ty + 1 : ty
    return valid(y, mo, d) ? iso(y, mo, d) : null
  }
  return null
}
