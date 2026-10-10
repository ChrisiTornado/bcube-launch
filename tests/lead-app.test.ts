import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../functions/lead/app';
import type { RuntimeConfig } from '../functions/lead/config';
import { OutboxMailer } from '../functions/lead/mailer';
import { MemoryLeadStore } from '../functions/lead/store';

const config: RuntimeConfig = {
  stage: 'test',
  siteUrl: 'https://bcube.test',
  mailFrom: 'BCube <hallo@bcube.test>',
  mailReplyTo: 'hallo@bcube.test',
  notifyEmail: 'owner@bcube.test',
  turnstileSecret: 'secret',
  turnstileBypass: false,
  ipHashSalt: 'test-salt',
  consentVersion: 'test-v1',
};

function event(method: string, path: string, opts: { body?: unknown; query?: Record<string, string>; ip?: string } = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: { 'cloudfront-viewer-address': `${opts.ip ?? '203.0.113.7'}:443` },
    queryStringParameters: opts.query,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    isBase64Encoded: false,
    requestContext: { http: { method, path, sourceIp: '10.0.0.1' } } as APIGatewayProxyEventV2['requestContext'],
  };
}

const validLead = {
  email: 'Band@Example.at ',
  name: 'Mia',
  role: 'band',
  city: 'Wien 7., Neubau',
  consent: true,
  turnstileToken: 'ok-token',
  company_website: '',
  elapsedMs: 8000,
  formId: 'waitlist_main',
  attribution: { utm_source: 'instagram', utm_medium: 'paid_social', utm_campaign: 'bcube_launch_2027', landing_path: '/' },
};

const linkFrom = (text: string, kind: 'confirm' | 'unsubscribe') => {
  const m = text.match(new RegExp(`https://bcube\\.test/api/${kind}\\?id=([a-f0-9]+)&token=([\\w-]+)`));
  if (!m) throw new Error(`Kein ${kind}-Link gefunden`);
  return { id: m[1]!, token: m[2]! };
};

describe('Lead-Funktion', () => {
  let store: MemoryLeadStore;
  let mailer: OutboxMailer;
  let turnstileOk: boolean;
  let clock: Date;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    clock = new Date('2026-11-01T12:00:00Z');
    store = new MemoryLeadStore(undefined, () => clock.getTime());
    mailer = new OutboxMailer();
    turnstileOk = true;
    app = createApp({
      config,
      store,
      mailer,
      verifyTurnstile: async (token) => ({ success: turnstileOk && token === 'ok-token', errorCodes: [] }),
      now: () => clock,
      log: () => {},
    });
  });

  it('speichert den Lead, sendet DOI-Mail und bestätigt per Link', async () => {
    const res = await app(event('POST', '/api/lead', { body: validLead }));
    expect(res.statusCode).toBe(200);

    const [lead] = await store.list();
    expect(lead).toMatchObject({ email: 'band@example.at', status: 'pending', role: 'band', city: 'Wien 7., Neubau' });
    expect(lead!.attribution.utm_source).toBe('instagram');
    expect(lead!.consent.version).toBe('test-v1');
    expect(lead!.consent.text).toMatch(/Datenschutzerklärung/);
    expect(lead!.ttl).toBeGreaterThan(0);
    expect(JSON.stringify(lead)).not.toContain('203.0.113.7'); // IP nur gehasht

    expect(mailer.sent).toHaveLength(1);
    const doi = mailer.sent[0]!;
    expect(doi.to).toBe('band@example.at');
    expect(doi.subject).toMatch(/bestätige/);
    expect(doi.html).toContain('Vormerkung bestätigen');
    expect(doi.headers?.['List-Unsubscribe']).toContain('/api/unsubscribe');

    const { id, token } = linkFrom(doi.text, 'confirm');
    const confirm = await app(event('GET', '/api/confirm', { query: { id, token } }));
    expect(confirm.statusCode).toBe(302);
    expect(confirm.headers?.location).toBe('https://bcube.test/bestaetigt/');

    const confirmed = await store.get(id);
    expect(confirmed).toMatchObject({ status: 'confirmed' });
    expect(confirmed!.ttl).toBeUndefined();
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[1]!.to).toBe('owner@bcube.test');
    expect(mailer.sent[1]!.text).toContain('utm_source: instagram');

    // Link erneut klicken bleibt erfolgreich, ohne zweite Benachrichtigung
    const again = await app(event('GET', '/api/confirm', { query: { id, token } }));
    expect(again.headers?.location).toBe('https://bcube.test/bestaetigt/');
    expect(mailer.sent).toHaveLength(2);
  });

  it('lehnt falsche oder abgelaufene Tokens ab', async () => {
    await app(event('POST', '/api/lead', { body: validLead }));
    const { id, token } = linkFrom(mailer.sent[0]!.text, 'confirm');

    const wrong = await app(event('GET', '/api/confirm', { query: { id, token: (token[0] === 'x' ? 'y' : 'x') + token.slice(1) } }));
    expect(wrong.headers?.location).toBe('https://bcube.test/bestaetigung-fehlgeschlagen/');

    clock = new Date('2026-12-15T12:00:00Z'); // > 30 Tage später
    const expired = await app(event('GET', '/api/confirm', { query: { id, token } }));
    expect(expired.headers?.location).toBe('https://bcube.test/bestaetigung-fehlgeschlagen/');
  });

  it('liefert Feldfehler bei ungültigen Eingaben', async () => {
    const res = await app(event('POST', '/api/lead', { body: { ...validLead, email: 'kaputt', role: 'astronaut', consent: false } }));
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body as string);
    expect(body.error).toBe('validation');
    expect(Object.keys(body.fields).sort()).toEqual(['consent', 'email', 'role']);
    expect(await store.list()).toHaveLength(0);
  });

  it('verwirft Honeypot- und Schnell-Absendungen still', async () => {
    const hp = await app(event('POST', '/api/lead', { body: { ...validLead, company_website: 'http://spam' } }));
    const fast = await app(event('POST', '/api/lead', { body: { ...validLead, elapsedMs: 300 } }));
    expect(hp.statusCode).toBe(200);
    expect(fast.statusCode).toBe(200);
    expect(await store.list()).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it('prüft Turnstile', async () => {
    turnstileOk = false;
    const res = await app(event('POST', '/api/lead', { body: validLead }));
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body as string).error).toBe('turnstile');
    expect(await store.list()).toHaveLength(0);
  });

  it('begrenzt Anfragen pro IP', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await app(event('POST', '/api/lead', { body: { ...validLead, email: `u${i}@example.at` }, ip: '198.51.100.1' }));
      codes.push(r.statusCode!);
    }
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
  });

  it('verrät nicht, ob eine Adresse schon bestätigt ist, und schickt keine Mail erneut', async () => {
    await app(event('POST', '/api/lead', { body: validLead }));
    const { id, token } = linkFrom(mailer.sent[0]!.text, 'confirm');
    await app(event('GET', '/api/confirm', { query: { id, token } }));
    const sentBefore = mailer.sent.length;

    clock = new Date(clock.getTime() + 60 * 60 * 1000);
    const dup = await app(event('POST', '/api/lead', { body: validLead, ip: '198.51.100.2' }));
    expect(dup.statusCode).toBe(200);
    expect(mailer.sent).toHaveLength(sentBefore);
  });

  it('sendet die DOI-Mail bei erneutem Eintrag erst nach der Wartezeit neu', async () => {
    await app(event('POST', '/api/lead', { body: validLead }));
    await app(event('POST', '/api/lead', { body: validLead, ip: '198.51.100.3' }));
    expect(mailer.sent).toHaveLength(1);
    clock = new Date(clock.getTime() + 6 * 60 * 1000);
    await app(event('POST', '/api/lead', { body: validLead, ip: '198.51.100.4' }));
    expect(mailer.sent).toHaveLength(2);
  });

  it('löscht den Lead beim Abmelden (GET und One-Click-POST)', async () => {
    await app(event('POST', '/api/lead', { body: validLead }));
    const { id, token } = linkFrom(mailer.sent[0]!.text, 'unsubscribe');
    const res = await app(event('GET', '/api/unsubscribe', { query: { id, token } }));
    expect(res.headers?.location).toBe('https://bcube.test/abgemeldet/');
    expect(await store.list()).toHaveLength(0);

    await app(event('POST', '/api/lead', { body: { ...validLead, email: 'zwei@example.at' }, ip: '198.51.100.5' }));
    const second = linkFrom(mailer.sent[1]!.text, 'unsubscribe');
    const post = await app(event('POST', '/api/unsubscribe', { query: second }));
    expect(post.statusCode).toBe(200);
    expect(await store.list()).toHaveLength(0);
  });

  it('Studiobetreiber:innen: eigener Einwilligungstext, eigene Mail und Bestätigungsseite, keine Gratis-Session', async () => {
    const operator = { studioName: 'Klangraum', studioType: 'proberaum' };
    await app(event('POST', '/api/lead', { body: { ...validLead, email: 'chef@klangraum.at', role: 'betreiber', operator }, ip: '198.51.100.9' }));
    const [lead] = await store.list();
    expect(lead!.consent.text).toMatch(/Partnerstudio/);
    expect(lead!.consent.text).not.toMatch(/Gratis-Session/);

    const doi = mailer.sent[0]!;
    expect(doi.subject).toMatch(/Partnerstudio/);
    expect(doi.html).toContain('Anfrage bestätigen');
    expect(doi.text + doi.html).not.toMatch(/gratis|Gutschein/i);

    const { id, token } = linkFrom(doi.text, 'confirm');
    const res = await app(event('GET', '/api/confirm', { query: { id, token } }));
    expect(res.headers?.location).toBe('https://bcube.test/partner-bestaetigt/');
    // wiederholter Klick bleibt auf der Partner-Seite
    const again = await app(event('GET', '/api/confirm', { query: { id, token } }));
    expect(again.headers?.location).toBe('https://bcube.test/partner-bestaetigt/');
  });

  it('Betreiber:innen müssen einen Studionamen angeben', async () => {
    const res = await app(event('POST', '/api/lead', { body: { ...validLead, email: 'x@klang.at', role: 'betreiber', formId: 'partner_main' }, ip: '198.51.100.20' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body as string).fields).toHaveProperty('studioName');
    expect(await store.list()).toHaveLength(0);
  });

  it('Kund:innen: Einwilligung nennt die Gratis-Session', async () => {
    await app(event('POST', '/api/lead', { body: validLead }));
    const [lead] = await store.list();
    expect(lead!.consent.text).toMatch(/Gratis-Session/);
    expect(mailer.sent[0]!.text).toMatch(/gratis 4-Stunden-Session/);
  });

  it('speichert Studiodaten nur für Betreiber:innen', async () => {
    const operator = { studioName: 'Klangraum', studioType: 'proberaum', website: 'https://klangraum.at' };
    await app(event('POST', '/api/lead', { body: { ...validLead, role: 'band', operator } }));
    await app(event('POST', '/api/lead', { body: { ...validLead, email: 'op@example.at', role: 'betreiber', operator }, ip: '198.51.100.6' }));
    const leads = await store.list();
    expect(leads.find((l) => l.role === 'band')!.operator).toBeUndefined();
    expect(leads.find((l) => l.role === 'betreiber')!.operator).toMatchObject({ studioName: 'Klangraum' });
    expect(mailer.sent[1]!.text).toMatch(/persönlich/);
    expect(mailer.sent[1]!.text).not.toMatch(/gratis/i);
  });

  it('antwortet 404 auf unbekannte Routen und 413 auf zu große Bodies', async () => {
    expect((await app(event('GET', '/api/nope'))).statusCode).toBe(404);
    expect((await app(event('POST', '/api/lead', { body: { email: 'x'.repeat(9000) } }))).statusCode).toBe(413);
  });
});
