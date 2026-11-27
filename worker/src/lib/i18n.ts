// 영어 화면을 위한 서버 문구 번역.
//
// 서버 코드는 문구를 한국어로 쓴다. 영어를 원하는 요청(Accept-Language 가 한국어가 아님)이면
// 응답을 내보내기 직전에 여기 표로 영어로 바꾼다(index.ts 의 미들웨어).
// 새 문구를 추가하면 여기에도 추가한다. 빠뜨리면 tests/i18n.test.mjs 가 알려 준다.

export type Lang = 'ko' | 'en'

/** 요청이 원하는 언어. 헤더가 없거나 첫 언어가 한국어면 한국어, 그 밖에는 영어. */
export const requestLang = (acceptLanguage: string | undefined | null): Lang => {
  const first = (acceptLanguage ?? '').trim().toLowerCase()
  return !first || first.startsWith('ko') ? 'ko' : 'en'
}

/** 입력 검증 문구에 들어가는 항목 이름. */
export const LABELS: Record<string, string> = {
  '이름': 'Name',
  '설명': 'Description',
  '메모': 'Note',
  '수량': 'Quantity',
  '구매일': 'Purchase date',
  '유효기간': 'Expiry date',
  '집': 'Home',
  '방': 'Place',
  '수납공간': 'Storage spot',
  '카테고리': 'Category',
  '태그': 'Tag',
  '만료 기준일': 'Expiry cutoff date',
  '집 이름': 'Home name',
  '방 이름': 'Place name',
  '정렬 순서': 'Sort order',
  '수납공간 이름': 'Storage spot name',
  '상위 수납공간': 'Parent storage spot',
  '옮길 보관장소': 'Destination place',
  '카테고리 이름': 'Category name',
  '태그 이름': 'Tag name',
}

const MESSAGES: Record<string, string> = {
  '인증이 필요합니다.': 'Please sign in.',
  '사용자를 찾을 수 없습니다.': 'User not found.',
  '서버 오류가 발생했습니다.': 'A server error occurred.',
  '요청한 API를 찾을 수 없습니다.': 'The requested API was not found.',
  '대상을 찾을 수 없습니다.': 'Not found.',
  '요청 본문이 올바르지 않습니다.': 'The request body is invalid.',
  '지원하지 않는 로그인입니다.': 'This sign-in method is not supported.',
  '로그인 설정이 준비되지 않았습니다.': 'Sign-in is not configured yet.',
  '잘못된 로그인 요청입니다.': 'Invalid sign-in request.',
  '허용되지 않은 복귀 주소입니다.': 'This return address is not allowed.',
  '태그 값이 올바르지 않습니다.': 'The tags are invalid.',
  '유효기간은 구매일보다 빠를 수 없습니다.': 'The expiry date cannot be earlier than the purchase date.',
  '집을 찾을 수 없습니다.': 'Home not found.',
  '방이 선택한 집에 속하지 않습니다.': 'The place does not belong to the selected home.',
  '수납공간을 지정하려면 방을 먼저 선택해야 합니다.': 'Select a place before choosing a storage spot.',
  '수납공간이 선택한 방에 속하지 않습니다.': 'The storage spot does not belong to the selected place.',
  '카테고리를 찾을 수 없습니다.': 'Category not found.',
  '존재하지 않는 태그가 포함되어 있습니다.': 'Some tags do not exist.',
  '이미지 파일이 필요합니다.': 'An image file is required.',
  '이미지는 10MB 이하여야 합니다.': 'Images must be 10 MB or smaller.',
  'jpg, png, webp, gif, heic 이미지만 올릴 수 있습니다.': 'Only jpg, png, webp, gif and heic images can be uploaded.',
  '상위 수납공간이 같은 방에 있지 않습니다.': 'The parent storage spot is not in the same place.',
  '자기 자신을 상위로 지정할 수 없습니다.': 'A storage spot cannot be its own parent.',
  '하위 수납공간을 상위로 지정할 수 없습니다.': 'A storage spot cannot be moved under one of its own children.',
  '옮길 보관장소를 선택해 주세요.': 'Select a destination place.',
  '같은 보관장소 안으로는 옮길 수 없습니다.': 'Cannot move into the same place.',
  '같은 집의 보관장소로만 옮길 수 있습니다.': 'You can only move to a place in the same home.',
  '이미 같은 이름이 있습니다.': 'That name already exists.',
  '탈퇴가 완료되었습니다.': 'Your account has been deleted.',
  'jpg, png, webp 이미지만 읽을 수 있습니다.': 'Only jpg, png and webp images can be read.',
  '읽을 사진은 2MB 이하여야 합니다.': 'Photos to read must be 2 MB or smaller.',
  '사진 읽기를 지금 사용할 수 없습니다.': 'Reading from photos is unavailable right now.',
  '오늘 사진 읽기 횟수를 모두 썼습니다. 날짜와 이름을 직접 입력해 주세요.': 'You have used all photo reads for today. Please enter the name and date yourself.',
  '사진을 읽지 못했습니다.': 'Could not read the photo.',
}

const label = (ko: string) => LABELS[ko] ?? ko

// 값이 들어가는 문구. 위에서부터 처음 맞는 것을 쓴다.
const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^(.+)을\(를\) 입력해주세요\.$/, (m) => `${label(m[1])} is required.`],
  [/^(.+)은\(는\) (\d+)자 이하여야 합니다\.$/, (m) => `${label(m[1])} must be ${m[2]} characters or fewer.`],
  [/^(.+) 형식이 올바르지 않습니다\.$/, (m) => `${label(m[1])} has an invalid format.`],
  [/^(.+) 값이 올바르지 않습니다\.$/, (m) => `${label(m[1])} is invalid.`],
  [/^태그는 (\d+)개까지 지정할 수 있습니다\.$/, (m) => `You can set up to ${m[1]} tags.`],
  [/^물건은 (\d+)개까지 등록할 수 있습니다\.$/, (m) => `You can add up to ${m[1]} items.`],
  [/^사진은 물건당 (\d+)장까지 올릴 수 있습니다\.$/, (m) => `You can upload up to ${m[1]} photos per item.`],
  [/^사진은 모두 (\d+)장까지 보관할 수 있습니다\. 쓰지 않는 사진을 지운 뒤 다시 시도해 주세요\.$/,
    (m) => `You can keep up to ${m[1]} photos in total. Delete photos you no longer need and try again.`],
  [/^하루에 올릴 수 있는 사진 수\((\d+)장\)를 넘었습니다\. 내일 다시 시도해 주세요\.$/,
    (m) => `You have reached the daily upload limit (${m[1]} photos). Please try again tomorrow.`],
]

/** 한국어 문구를 영어로 바꾼다. 표에 없으면 원문을 그대로 돌려준다. */
export const toEnglish = (message: string): string => {
  const exact = MESSAGES[message]
  if (exact) return exact
  for (const [pattern, build] of PATTERNS) {
    const m = message.match(pattern)
    if (m) return build(m)
  }
  return message
}
