import { z } from 'zod';
import type { PublicStudio, StudiosFile } from '../src/lib/studios.ts';

/**
 * Form der Antwort von GET /api/studios (studio-service). Enthält interne Felder
 * (id, smartlockId, createdAt, Base64-Bilder) – die werden hier gelesen, aber NIE exportiert.
 */
export const apiStudioSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  street: z.string().optional().nullable(),
  plz: z.union([z.number(), z.string()]).optional().nullable(),
  city: z.string().min(1),
  country: z.string().min(1),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
  active: z.boolean().optional(),
  hourlyRateCents: z.number().int().positive().nullable().optional(),
  imageBase64: z.string().nullable().optional(),
  imageGalleryBase64: z.array(z.string()).nullable().optional(),
});
export type ApiStudio = z.infer<typeof apiStudioSchema>;

export const apiResponseSchema = z.object({
  data: z.array(apiStudioSchema),
});

const statusSchema = z.enum(['open', 'coming_soon']);
const kindSchema = z.enum(['cube', 'partner']);

export const overrideSchema = z
  .object({
    kind: kindSchema.optional(),
    status: statusSchema.optional(),
    statusLabel: z.string().max(60).optional(),
    teaser: z.string().max(220).optional(),
    hidePrice: z.boolean().optional(),
    exclude: z.boolean().optional(),
    /** Anzeigename statt des Namens aus der Datenbank */
    name: z.string().min(1).max(80).optional(),
    /** Nur für die Reihenfolge, wird nicht exportiert (kleiner = weiter oben) */
    sortOrder: z.number().int().optional(),
  })
  .strict();

export const additionalSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(80),
    kind: kindSchema,
    status: statusSchema,
    statusLabel: z.string().max(60).optional(),
    street: z.string().max(80).optional(),
    plz: z.string().max(10).optional(),
    city: z.string().min(1),
    country: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    teaser: z.string().max(220).optional(),
    image: z.string().optional(),
    priceFromCents: z.number().int().positive().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

export const extraSchema = z
  .object({
    $comment: z.string().optional(),
    overrides: z.record(z.string(), overrideSchema).default({}),
    additional: z.array(additionalSchema).default([]),
  })
  .strict();
export type ExtraFile = z.infer<typeof extraSchema>;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Koordinaten auf ~11 m runden – reicht für die Karte und vermeidet Scheingenauigkeit. */
const roundCoord = (n: number) => Math.round(n * 10000) / 10000;

export interface MappedStudio {
  studio: PublicStudio;
  /** Base64 des Titelbilds, wird separat als WebP geschrieben (nie ins JSON). */
  imageBase64?: string;
  sortOrder: number;
}

/**
 * Whitelist-Mapping: Nur die hier explizit gesetzten Felder verlassen das Skript.
 * Inaktive Studios und Studios ohne Koordinaten werden übersprungen.
 */
export function mapApiStudios(apiStudios: ApiStudio[], extra: ExtraFile): { mapped: MappedStudio[]; skipped: string[] } {
  const mapped: MappedStudio[] = [];
  const skipped: string[] = [];

  for (const s of apiStudios) {
    const active = s.isActive ?? s.active ?? true;
    const slug = slugify(s.name);
    const override = extra.overrides[slug] ?? {};
    if (!active || override.exclude) {
      skipped.push(`${slug} (inaktiv/ausgeschlossen)`);
      continue;
    }
    if (s.latitude == null || s.longitude == null) {
      skipped.push(`${slug} (keine Koordinaten)`);
      continue;
    }
    const studio: PublicStudio = {
      slug,
      name: (override.name ?? s.name).trim(),
      kind: override.kind ?? 'cube',
      status: override.status ?? 'open',
      ...(override.statusLabel ? { statusLabel: override.statusLabel } : {}),
      ...(s.street ? { street: s.street.trim() } : {}),
      ...(s.plz != null ? { plz: String(s.plz) } : {}),
      city: s.city.trim(),
      country: s.country.trim(),
      lat: roundCoord(s.latitude),
      lng: roundCoord(s.longitude),
      // Die DB-Beschreibung wird bewusst NICHT übernommen (Kampagnentext kommt aus studios.extra.json).
      ...(override.teaser ? { teaser: override.teaser } : {}),
      ...(s.hourlyRateCents && !override.hidePrice ? { priceFromCents: s.hourlyRateCents } : {}),
    };
    const imageBase64 = s.imageGalleryBase64?.[0] || s.imageBase64 || undefined;
    mapped.push({ studio, imageBase64, sortOrder: override.sortOrder ?? 100 });
  }

  for (const a of extra.additional) {
    if (mapped.some((m) => m.studio.slug === a.slug)) {
      skipped.push(`${a.slug} (Duplikat in additional)`);
      continue;
    }
    const { sortOrder, ...rest } = a;
    mapped.push({ studio: { ...rest, lat: roundCoord(a.lat), lng: roundCoord(a.lng) }, sortOrder: sortOrder ?? 100 });
  }

  const kindRank = (m: MappedStudio) => (m.studio.kind === 'cube' ? 0 : 1);
  mapped.sort((x, y) => kindRank(x) - kindRank(y) || x.sortOrder - y.sortOrder || x.studio.name.localeCompare(y.studio.name, 'de'));
  return { mapped, skipped };
}

export function buildFile(studios: PublicStudio[], source: string): StudiosFile {
  return { generatedAt: new Date().toISOString(), source, studios };
}

/** Erlaubte Schlüssel im öffentlichen JSON – Sicherheitsnetz gegen versehentliche Lecks. */
export const ALLOWED_KEYS = new Set([
  'slug', 'name', 'kind', 'status', 'statusLabel', 'street', 'plz', 'city', 'country',
  'lat', 'lng', 'teaser', 'image', 'priceFromCents',
]);

export function assertOnlyPublicKeys(studios: PublicStudio[]): void {
  for (const s of studios) {
    for (const key of Object.keys(s)) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new Error(`Nicht erlaubtes Feld "${key}" in Studio "${s.slug}" – Export abgebrochen.`);
      }
    }
  }
}
