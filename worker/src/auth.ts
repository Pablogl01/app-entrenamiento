// Cuenta de usuario con dos credenciales (plans/007):
//  - access token: JWT HS256 de 15 min, solo en memoria del cliente.
//  - refresh token: 32 bytes aleatorios en cookie HttpOnly limitada a /api/auth,
//    90 días deslizantes, rotado en cada uso; el servidor guarda su SHA-256.
// Contraseñas con PBKDF2-SHA-256 (WebCrypto): Workers no tiene bcrypt/argon2 y
// limita PBKDF2 a 100 000 iteraciones y el plan gratuito da 10 ms de CPU: 50 000
// (~6,6 ms medidos en local) deja margen. Se guarda por fila para poder subirla.

export const ACCESS_TTL_S = 15 * 60
export const REFRESH_TTL_S = 90 * 24 * 3600
export const PBKDF2_ITERATIONS = 50_000
export const MIN_PASSWORD_LENGTH = 10
export const LOCK_AFTER_FAILURES = 10
export const LOCK_MS = 15 * 60_000
export const REGISTER_PER_HOUR = 5
export const REFRESH_COOKIE = 'rt'
const REFRESH_COOKIE_PATH = '/api/auth'

const enc = new TextEncoder()

// ---- base64url ----

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (const b of u8) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function sha256hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)))
}

/** Comparación en tiempo constante: no filtrar por cuántos bytes coinciden. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ---- Contraseñas ----

export interface PasswordRecord {
  hash: string
  salt: string
  iterations: number
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, iterations)
  return { hash: b64url(hash), salt: b64url(salt), iterations }
}

export async function verifyPassword(password: string, rec: PasswordRecord): Promise<boolean> {
  const hash = await pbkdf2(password, b64urlDecode(rec.salt), rec.iterations)
  return equalBytes(hash, b64urlDecode(rec.hash))
}

// ---- JWT HS256 ----

export interface AccessClaims {
  sub: string
  email: string
  iat: number
  exp: number
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

export async function signAccessToken(userId: string, email: string, secret: string, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000)
  const claims: AccessClaims = { sub: userId, email, iat, exp: iat + ACCESS_TTL_S }
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64url(enc.encode(JSON.stringify(claims)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(`${head}.${body}`))
  return `${head}.${body}.${b64url(sig)}`
}

/** Devuelve las claims si la firma es válida y no ha caducado; null en cualquier otro caso. */
export async function verifyAccessToken(token: string, secret: string, now = Date.now()): Promise<AccessClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, body, sig] = parts
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), b64urlDecode(sig) as BufferSource, enc.encode(`${head}.${body}`))
    if (!ok) return null
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Partial<AccessClaims>
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string' || typeof claims.exp !== 'number') return null
    if (claims.exp * 1000 <= now) return null
    return claims as AccessClaims
  } catch {
    return null
  }
}

// ---- Cookie del refresh token ----

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie')
  if (header === null) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return null
}

export function refreshCookie(value: string): string {
  return `${REFRESH_COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=${REFRESH_COOKIE_PATH}; Max-Age=${REFRESH_TTL_S}`
}

export function clearedRefreshCookie(): string {
  return `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=${REFRESH_COOKIE_PATH}; Max-Age=0`
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  // Suficiente para no guardar basura; la verificación real llegará con el correo saliente.
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}
