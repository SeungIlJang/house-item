// 업로드 전 사진 압축.
//
// 휴대폰 원본(장당 3~10MB)을 그대로 올리면 R2 무료 용량(10GB)이 사진 1~3천 장에서 찬다.
// 긴 변 1600px · JPEG 품질 0.8 로 줄이면 장당 300KB 안팎이 되어 화면에서 보기에는 충분하다.

export const MAX_SIDE = 1600
export const JPEG_QUALITY = 0.8

/** 줄인 뒤의 크기. 이미 작으면 그대로 둔다. */
export function fitWithin(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height }
  const scale = maxSide / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    // <img> 는 EXIF 회전 정보를 적용해서 그리므로 세로 사진이 눕지 않는다.
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image decode failed'))
    }
    img.src = url
  })
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * 사진을 JPEG 로 줄인다. 압축할 수 없거나(움직이는 GIF, 브라우저가 못 읽는 HEIC 등)
 * 결과가 원본보다 커지면 원본을 그대로 돌려준다. 업로드가 압축 때문에 실패하지 않게 하기 위해서다.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file
  try {
    const img = await loadImage(file)
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // 투명 PNG 를 JPEG 로 바꾸면 배경이 검게 되므로 흰색을 먼저 칠한다.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await toJpeg(canvas, JPEG_QUALITY)
    if (!blob || blob.size >= file.size) return file
    const baseName = file.name.replace(/\.[^.]+$/, '') || `photo_${Date.now()}`
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
