import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Schlüssel eines Leads: HMAC der E-Mail. Nicht umkehrbar ohne Salt (Salt daher NICHT rotieren). */
export const leadId = (email: string, salt: string) => createHmac('sha256', salt).update(email.toLowerCase()).digest('hex').slice(0, 40);

export const hashIp = (ip: string, salt: string) => createHmac('sha256', salt).update(`ip:${ip}`).digest('hex').slice(0, 32);

export const newToken = () => randomBytes(32).toString('base64url');

export function safeEqualHex(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
