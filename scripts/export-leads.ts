/**
 * Exportiert Leads als CSV (für Auswertung der DOI-Rate pro Kanal oder Auskunftsanfragen).
 *
 *   npm run export:leads -- --table=bcube-launch-prod-leads [--status=confirmed] [--out=leads.csv]
 *   npm run export:leads -- --local          (liest dev/leads.local.json)
 *
 * Benötigt AWS-Zugangsdaten mit dynamodb:Scan. Die CSV enthält personenbezogene Daten –
 * nicht einchecken (siehe .gitignore), nach Gebrauch löschen.
 */
import { writeFile } from 'node:fs/promises';
import { DynamoLeadStore, MemoryLeadStore } from '../functions/lead/store.ts';
import type { Lead } from '../functions/lead/types.ts';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']));

const store = args.local ? new MemoryLeadStore('dev/leads.local.json') : new DynamoLeadStore(args.table ?? process.env.TABLE_NAME ?? '');
if (!args.local && !(args.table ?? process.env.TABLE_NAME)) {
  console.error('Bitte --table=<name> angeben (terraform output leads_table_name).');
  process.exit(1);
}

const leads = (await store.list()).filter((l) => !args.status || l.status === args.status);
const cols: [string, (l: Lead) => string | undefined][] = [
  ['email', (l) => l.email],
  ['status', (l) => l.status],
  ['role', (l) => l.role],
  ['name', (l) => l.name],
  ['city', (l) => l.city],
  ['studio_name', (l) => l.operator?.studioName],
  ['studio_city', (l) => l.operator?.studioCity],
  ['studio_type', (l) => l.operator?.studioType],
  ['studio_website', (l) => l.operator?.website],
  ['utm_source', (l) => l.attribution.utm_source],
  ['utm_medium', (l) => l.attribution.utm_medium],
  ['utm_campaign', (l) => l.attribution.utm_campaign],
  ['utm_content', (l) => l.attribution.utm_content],
  ['referrer', (l) => l.attribution.referrer],
  ['form_id', (l) => l.formId],
  ['created_at', (l) => l.createdAt],
  ['confirmed_at', (l) => l.confirmedAt],
  ['consent_version', (l) => l.consent.version],
];
const esc = (v: string | undefined) => {
  const s = (v ?? '').replace(/^[=+\-@]/, "'$&"); // CSV-Injection in Tabellenprogrammen verhindern
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [cols.map(([h]) => h).join(','), ...leads.map((l) => cols.map(([, f]) => esc(f(l))).join(','))].join('\n');
const out = args.out ?? 'leads-export.csv';
await writeFile(out, csv + '\n', 'utf8');

// Kurze Kanalauswertung: eingetragen vs. bestätigt pro utm_source
const byChannel = new Map<string, { total: number; confirmed: number }>();
for (const l of leads) {
  const key = l.attribution.utm_source ?? (l.attribution.referrer ? `ref:${new URL(l.attribution.referrer).host}` : '(direkt)');
  const e = byChannel.get(key) ?? { total: 0, confirmed: 0 };
  e.total++;
  if (l.status === 'confirmed') e.confirmed++;
  byChannel.set(key, e);
}
console.log(`✓ ${leads.length} Leads nach ${out} exportiert.\n`);
console.table([...byChannel].map(([channel, e]) => ({ Kanal: channel, Eingetragen: e.total, Bestätigt: e.confirmed, 'DOI-Rate': `${Math.round((e.confirmed / e.total) * 100)} %` })));
