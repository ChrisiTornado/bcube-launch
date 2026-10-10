import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { consentTextFor } from '../../src/lib/consent.ts';
import { audienceForRole } from '../../src/lib/roles.ts';
import type { RuntimeConfig } from './config.ts';
import { hashIp, leadId, newToken, safeEqualHex, sha256 } from './crypto.ts';
import { fieldErrors, leadRequestSchema } from './schema.ts';
import { doiMail } from './templates/doi.ts';
import { notifyMail } from './templates/notify.ts';
import type { TurnstileResult } from './turnstile.ts';
import type { Lead, LeadStore, Mailer } from './types.ts';

export interface Deps {
  config: RuntimeConfig;
  store: LeadStore;
  mailer: Mailer;
  verifyTurnstile: (token: string, secret: string, ip?: string) => Promise<TurnstileResult>;
  now?: () => Date;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

type Result = APIGatewayProxyStructuredResultV2;

const DAY = 24 * 60 * 60;
const PENDING_TTL_SECONDS = 30 * DAY;
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_FILL_MS = 2500;
const RATE_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT = 5;
const MAX_BODY_BYTES = 8 * 1024;

const json = (statusCode: number, body: unknown): Result => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

const redirect = (location: string): Result => ({
  statusCode: 302,
  headers: { location, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  body: '',
});

/** Echte Client-IP: CloudFront-Viewer-Address (von CloudFront gesetzt) > X-Forwarded-For > Quell-IP. */
export function clientIp(event: APIGatewayProxyEventV2): string {
  const h = event.headers ?? {};
  const viewer = h['cloudfront-viewer-address'];
  if (viewer) return viewer.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const xff = h['x-forwarded-for'];
  if (xff) return xff.split(',')[0]!.trim();
  return event.requestContext?.http?.sourceIp ?? 'unknown';
}

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new Error('too_large');
  return JSON.parse(raw);
}

export function createApp(deps: Deps) {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((event, data) => console.log(JSON.stringify({ event, ...data })));
  const { config, store, mailer } = deps;

  const links = (id: string, token: string, unsubToken: string) => {
    const base = `${config.siteUrl}/api`;
    return {
      confirmUrl: `${base}/confirm?id=${id}&token=${token}`,
      unsubscribeUrl: `${base}/unsubscribe?id=${id}&token=${unsubToken}`,
    };
  };

  async function sendDoi(lead: Lead, token: string, unsubToken: string) {
    const { confirmUrl, unsubscribeUrl } = links(lead.id, token, unsubToken);
    const mail = doiMail({ siteUrl: config.siteUrl, name: lead.name, confirmUrl, unsubscribeUrl, isOperator: audienceForRole(lead.role) === 'operator' });
    await mailer.send({
      to: lead.email,
      ...mail,
      replyTo: config.mailReplyTo,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  }

  async function handleLead(event: APIGatewayProxyEventV2): Promise<Result> {
    let body: unknown;
    try {
      body = parseBody(event);
    } catch (err) {
      return json(err instanceof Error && err.message === 'too_large' ? 413 : 400, { error: 'bad_request' });
    }

    const parsed = leadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(400, { error: 'validation', fields: fieldErrors(parsed.error) });
    }
    const input = parsed.data;
    const ip = clientIp(event);
    const ipHash = hashIp(ip, config.ipHashSalt);

    // Bots bekommen eine scheinbar erfolgreiche Antwort, damit sie nichts dazulernen.
    if (input.company_website || (input.elapsedMs !== undefined && input.elapsedMs < MIN_FILL_MS)) {
      log('lead_spam_dropped', { reason: input.company_website ? 'honeypot' : 'too_fast', ipHash });
      return json(200, { ok: true });
    }

    const hits = await store.hit(`ip:${ipHash}`, RATE_WINDOW_SECONDS);
    if (hits > RATE_LIMIT) {
      log('lead_rate_limited', { ipHash, hits });
      return json(429, { error: 'rate_limit' });
    }

    if (!config.turnstileBypass) {
      const ts = await deps.verifyTurnstile(input.turnstileToken, config.turnstileSecret, ip);
      if (!ts.success) {
        log('lead_turnstile_failed', { ipHash, codes: ts.errorCodes });
        return json(403, { error: 'turnstile' });
      }
    }

    const id = leadId(input.email, config.ipHashSalt);
    const existing = await store.get(id);
    const nowDate = now();
    const nowIso = nowDate.toISOString();

    if (existing?.status === 'confirmed') {
      // Keine Info preisgeben, ob eine Adresse schon eingetragen ist.
      log('lead_duplicate_confirmed', { id });
      return json(200, { ok: true });
    }
    if (existing && nowDate.getTime() - Date.parse(existing.lastMailAt) < RESEND_COOLDOWN_MS) {
      log('lead_resend_cooldown', { id });
      return json(200, { ok: true });
    }

    const token = newToken();
    const unsubToken = newToken();
    const lead: Lead = {
      id,
      email: input.email,
      status: 'pending',
      role: input.role,
      name: input.name,
      city: input.city,
      operator: input.role === 'betreiber' ? input.operator : undefined,
      attribution: input.attribution,
      formId: input.formId,
      ctaLocation: input.ctaLocation,
      consent: { text: consentTextFor(input.role), version: config.consentVersion, at: nowIso },
      ipHash,
      tokenHash: sha256(token),
      tokenExpiresAt: new Date(nowDate.getTime() + PENDING_TTL_SECONDS * 1000).toISOString(),
      unsubTokenHash: sha256(unsubToken),
      lastMailAt: nowIso,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
      ttl: Math.floor(nowDate.getTime() / 1000) + PENDING_TTL_SECONDS,
    };

    await store.put(lead);
    try {
      await sendDoi(lead, token, unsubToken);
    } catch (err) {
      log('lead_mail_failed', { id, error: err instanceof Error ? err.message : String(err) });
      return json(502, { error: 'mail' });
    }
    log('lead_created', { id, role: lead.role, resend: !!existing, utm_source: lead.attribution.utm_source });
    return json(200, { ok: true });
  }

  async function handleConfirm(event: APIGatewayProxyEventV2): Promise<Result> {
    const q = event.queryStringParameters ?? {};
    const fail = redirect(`${config.siteUrl}/bestaetigung-fehlgeschlagen/`);
    if (!q.id || !q.token || !/^[a-f0-9]{40}$/.test(q.id)) return fail;

    const lead = await store.get(q.id);
    if (!lead || !safeEqualHex(lead.tokenHash, sha256(q.token))) return fail;
    // Studiobetreiber:innen bekommen keine Gratis-Session und deshalb eine eigene Bestätigungsseite.
    const done = redirect(`${config.siteUrl}/${lead.role === 'betreiber' ? 'partner-bestaetigt' : 'bestaetigt'}/`);
    if (lead.status === 'confirmed') return done;
    if (Date.parse(lead.tokenExpiresAt) < now().getTime()) return fail;

    const confirmed: Lead = { ...lead, status: 'confirmed', confirmedAt: now().toISOString(), updatedAt: now().toISOString(), ttl: undefined };
    await store.put(confirmed);
    log('lead_confirmed', { id: lead.id, role: lead.role, utm_source: lead.attribution.utm_source });

    if (config.notifyEmail) {
      try {
        await mailer.send({ to: config.notifyEmail, ...notifyMail(confirmed, config.siteUrl) });
      } catch (err) {
        // Bestätigung ist gespeichert; fehlende interne Benachrichtigung darf den Nutzer nicht blockieren.
        log('notify_mail_failed', { id: lead.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return done;
  }

  async function handleUnsubscribe(event: APIGatewayProxyEventV2): Promise<Result> {
    const q = event.queryStringParameters ?? {};
    const done = redirect(`${config.siteUrl}/abgemeldet/`);
    if (q.id && q.token && /^[a-f0-9]{40}$/.test(q.id)) {
      const lead = await store.get(q.id);
      if (lead && safeEqualHex(lead.unsubTokenHash, sha256(q.token))) {
        await store.delete(lead.id);
        log('lead_unsubscribed', { id: lead.id });
      }
    }
    // One-Click-Abmeldung (RFC 8058) kommt als POST vom Mail-Client und erwartet nur 200.
    return event.requestContext.http.method === 'POST' ? json(200, { ok: true }) : done;
  }

  return async function handle(event: APIGatewayProxyEventV2): Promise<Result> {
    const method = event.requestContext.http.method;
    const path = event.rawPath.replace(/\/+$/, '');
    try {
      if (path === '/api/lead' && method === 'POST') return await handleLead(event);
      if (path === '/api/confirm' && method === 'GET') return await handleConfirm(event);
      if (path === '/api/unsubscribe' && (method === 'GET' || method === 'POST')) return await handleUnsubscribe(event);
      if (path === '/api/health' && method === 'GET') return json(200, { ok: true });
      return json(404, { error: 'not_found' });
    } catch (err) {
      log('unhandled_error', { path, error: err instanceof Error ? err.message : String(err) });
      return json(500, { error: 'server' });
    }
  };
}
