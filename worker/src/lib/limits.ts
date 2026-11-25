// 사용량 제한. 무료 한도(R2 10GB, D1 5GB) 안에서 한 사용자가 전체 용량을 다 쓰지 못하게 한다.
// 앱이 사진을 장당 약 300KB 로 줄여 올리므로 1,000장은 약 300MB 다.
// 수치는 여기서만 바꾸면 된다. 이용약관(home-items-app/src/legal/documents.ts)의 안내 문구도 함께 고친다.
export const LIMITS = {
  /** 물건 한 개에 붙일 수 있는 사진 수 */
  imagesPerItem: 3,
  /** 사용자 한 명이 보관할 수 있는 사진 총수 */
  imagesPerUser: 1000,
  /** 사용자 한 명이 24시간 동안 올릴 수 있는 사진 수 (자동화된 대량 업로드 차단) */
  uploadsPerDay: 200,
  /** 사용자 한 명이 등록할 수 있는 물건 수 */
  itemsPerUser: 3000,
  /** 사용자 한 명이 하루(UTC)에 사진에서 이름·유통기한을 읽을 수 있는 횟수 */
  labelReadsPerUserPerDay: 30,
  /**
   * 모든 사용자를 합쳐 하루(UTC)에 읽을 수 있는 횟수. Workers AI 무료 한도(하루 10,000 뉴런) 안에 머물게 한다.
   * 실측: 긴 변 1024px 사진 한 장에 약 57 뉴런 → 150회면 약 8,600 뉴런.
   */
  labelReadsPerDay: 150,
}
