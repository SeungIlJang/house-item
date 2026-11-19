export const b64url = (value: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
export const fromB64url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
export const sign = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
}
export const makeToken = async (userId: number, secret: string, remember = true) => {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ sub: String(userId), exp: Math.floor(Date.now() / 1000) + (remember ? 2592000 : 3600) }))
  const body = `${header}.${payload}`
  return `${body}.${await sign(body, secret)}`
}
export const verifyToken = async (token: string, secret: string) => {
  const parts = token.split('.')
  if (parts.length !== 3 || await sign(`${parts[0]}.${parts[1]}`, secret) !== parts[2]) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])))
    return payload.exp > Date.now() / 1000 ? Number(payload.sub) : null
  } catch { return null }
}
