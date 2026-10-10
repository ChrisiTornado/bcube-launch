import { describe, expect, it } from 'vitest';
import { assertOnlyPublicKeys, extraSchema, mapApiStudios, slugify } from '../scripts/studio-export-lib';
import type { PublicStudio } from '../src/lib/studios';

const apiStudio = {
  id: 7,
  smartlockId: 123456,
  name: 'bcube Studio Hauptbahnhof',
  description: 'Interne Beschreibung mit Yoga-Bereich',
  street: 'Alfred-Adler-Straße 55',
  plz: 1100,
  city: 'Wien',
  country: 'Österreich',
  latitude: 48.185123,
  longitude: 16.379543,
  imageBase64: 'AAAA',
  imageGalleryBase64: ['BBBB'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  hourlyRateCents: 2000,
};

describe('Studio-Export', () => {
  it('übernimmt nur freigegebene Felder', () => {
    const { mapped } = mapApiStudios([apiStudio], extraSchema.parse({}));
    const s = mapped[0]!.studio as unknown as Record<string, unknown>;
    expect(s).not.toHaveProperty('id');
    expect(s).not.toHaveProperty('smartlockId');
    expect(s).not.toHaveProperty('description');
    expect(s).not.toHaveProperty('createdAt');
    expect(JSON.stringify(s)).not.toContain('AAAA');
    expect(s).toMatchObject({ slug: 'bcube-studio-hauptbahnhof', plz: '1100', lat: 48.1851, lng: 16.3795, priceFromCents: 2000 });
    expect(mapped[0]!.imageBase64).toBe('BBBB');
  });

  it('überspringt inaktive Studios und Studios ohne Koordinaten', () => {
    const { mapped, skipped } = mapApiStudios(
      [{ ...apiStudio, isActive: false }, { ...apiStudio, name: 'Ohne Ort', latitude: null }],
      extraSchema.parse({}),
    );
    expect(mapped).toHaveLength(0);
    expect(skipped).toHaveLength(2);
  });

  it('wendet Overrides an und ergänzt zusätzliche Standorte', () => {
    const extra = extraSchema.parse({
      overrides: { 'bcube-studio-hauptbahnhof': { status: 'coming_soon', teaser: 'Kampagnentext', hidePrice: true } },
      additional: [{ slug: 'partner-x', name: 'Partner X', kind: 'partner', status: 'open', city: 'Graz', country: 'Österreich', lat: 47.07, lng: 15.44 }],
    });
    const { mapped } = mapApiStudios([apiStudio], extra);
    expect(mapped.map((m) => m.studio.slug)).toEqual(['bcube-studio-hauptbahnhof', 'partner-x']);
    expect(mapped[0]!.studio).toMatchObject({ status: 'coming_soon', teaser: 'Kampagnentext' });
    expect(mapped[0]!.studio.priceFromCents).toBeUndefined();
  });

  it('bricht bei unbekannten Feldern ab', () => {
    const leaky = { slug: 'x', smartlockId: 1 } as unknown as PublicStudio;
    expect(() => assertOnlyPublicKeys([leaky])).toThrow(/smartlockId/);
  });

  it('erzeugt Slugs mit Umlauten', () => {
    expect(slugify('Studio Größe Ölmühle')).toBe('studio-groesse-oelmuehle');
  });
});
