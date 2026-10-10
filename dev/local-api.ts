/**
 * Lokaler Server für die Lead-Funktion: übersetzt HTTP-Anfragen in API-Gateway-Events (v2)
 * und ruft denselben Code auf wie in AWS. Leads landen in dev/leads.local.json, Mails in dev/outbox/.
 *
 *   npm run dev:api     (Port LOCAL_API_PORT, Standard 8787; Astro-Dev leitet /api dorthin weiter)
 */
import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createApp } from '../functions/lead/app.ts';
import { loadConfig } from '../functions/lead/config.ts';
import { OutboxMailer } from '../functions/lead/mailer.ts';
import { MemoryLeadStore } from '../functions/lead/store.ts';
import { verifyTurnstile } from '../functions/lead/turnstile.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, '.env');
if (existsSync(envFile)) loadEnvFile(envFile);
process.env.STAGE ??= 'local';
process.env.SITE_URL ??= 'http://localhost:4321';

const config = await loadConfig();
const app = createApp({
  config,
  store: new MemoryLeadStore(resolve(root, 'dev/leads.local.json')),
  mailer: new OutboxMailer(resolve(root, 'dev/outbox')),
  verifyTurnstile,
  log: (event, data) => console.log(`[lead] ${event}`, data ?? ''),
});

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export function toEvent(req: IncomingMessage, body: string): APIGatewayProxyEventV2 {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k.toLowerCase()] = v;
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: body || undefined,
    isBase64Encoded: false,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      requestId: crypto.randomUUID(),
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      http: { method: req.method ?? 'GET', path: url.pathname, protocol: 'HTTP/1.1', sourceIp: req.socket.remoteAddress ?? '127.0.0.1', userAgent: headers['user-agent'] ?? '' },
    },
  };
}

const port = Number(process.env.LOCAL_API_PORT ?? 8787);
createServer(async (req, res) => {
  const result = await app(toEvent(req, await readBody(req)));
  res.writeHead(result.statusCode ?? 200, result.headers as Record<string, string>);
  res.end(result.body ?? '');
}).listen(port, () => {
  console.log(`Lead-API läuft auf http://localhost:${port} (Turnstile-Bypass: ${config.turnstileBypass})`);
});
