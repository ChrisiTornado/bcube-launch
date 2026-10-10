const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
}

export async function verifyTurnstile(token: string, secret: string, remoteIp?: string, fetchImpl: typeof fetch = fetch): Promise<TurnstileResult> {
  if (!token) return { success: false, errorCodes: ['missing-input-response'] };
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const res = await fetchImpl(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    return { success: data.success === true, errorCodes: data['error-codes'] ?? [] };
  } catch (err) {
    return { success: false, errorCodes: ['network-error', err instanceof Error ? err.message : String(err)] };
  }
}
