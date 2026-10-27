import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Keyed hash, so short codes (6-digit OTPs) cannot be brute-forced from a DB leak. */
export function hmac(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function randomOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// AES-256-GCM for secrets at rest (TOTP secrets). Output: iv.tag.ciphertext (base64url).
function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encrypt(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString('base64url'))
    .join('.');
}

export function decrypt(payload: string, secret: string): string {
  const [iv, tag, data] = payload
    .split('.')
    .map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
