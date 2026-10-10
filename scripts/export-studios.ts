/**
 * Exportiert die öffentlichen Studiodaten aus dem bcube studio-service nach src/data/studios.json.
 *
 *   npm run export:studios -- --api=http://localhost:8082        (lokal, docker compose)
 *   npm run export:studios -- --api=https://app.bcube.at          (Produktion)
 *   npm run export:studios -- --input=./studios-response.json     (gespeicherte API-Antwort)
 *
 * Nur freigegebene Felder werden übernommen (siehe studio-export-lib.ts). Titelbilder werden
 * als WebP nach public/studios/<slug>.webp geschrieben, nie als Base64 ins JSON.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { apiResponseSchema, assertOnlyPublicKeys, buildFile, extraSchema, mapApiStudios } from './studio-export-lib.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || 'true'];
  }),
);

async function loadApiResponse(): Promise<{ json: unknown; source: string }> {
  if (args.input) {
    const file = resolve(process.cwd(), args.input);
    return { json: JSON.parse(await readFile(file, 'utf8')), source: 'file' };
  }
  const base = (args.api || process.env.STUDIO_API_URL || 'http://localhost:8082').replace(/\/$/, '');
  const url = `${base}/api/studios`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`API antwortet mit ${res.status} für ${url}`);
  return { json: await res.json(), source: new URL(base).host };
}

async function main() {
  const { json, source } = await loadApiResponse();
  const api = apiResponseSchema.parse(json);
  const extraPath = resolve(root, 'src/data/studios.extra.json');
  const extra = extraSchema.parse(JSON.parse(await readFile(extraPath, 'utf8')));

  const { mapped, skipped } = mapApiStudios(api.data, extra);
  const imgDir = resolve(root, 'public/studios');
  await mkdir(imgDir, { recursive: true });

  for (const m of mapped) {
    if (!m.imageBase64) continue;
    const raw = m.imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');
    const out = resolve(imgDir, `${m.studio.slug}.webp`);
    await sharp(Buffer.from(raw, 'base64')).rotate().resize({ width: 640, height: 400, fit: 'cover' }).webp({ quality: 72 }).toFile(out);
    m.studio.image = `/studios/${m.studio.slug}.webp`;
  }

  const studios = mapped.map((m) => m.studio);
  assertOnlyPublicKeys(studios);
  const file = buildFile(studios, source);
  const outPath = resolve(root, 'src/data/studios.json');
  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  console.log(`✓ ${studios.length} Studios nach src/data/studios.json exportiert (Quelle: ${source}).`);
  for (const s of skipped) console.log(`  übersprungen: ${s}`);
}

main().catch((err) => {
  console.error('✗ Export fehlgeschlagen:', err instanceof Error ? err.message : err);
  process.exit(1);
});
