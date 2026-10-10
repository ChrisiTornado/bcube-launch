/** Öffentliches Studio-Format in src/data/studios.json (erzeugt von scripts/export-studios.ts). */
export type StudioKind = 'cube' | 'partner';
export type StudioStatus = 'open' | 'coming_soon';

export interface PublicStudio {
  slug: string;
  name: string;
  kind: StudioKind;
  status: StudioStatus;
  statusLabel?: string;
  street?: string;
  plz?: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  teaser?: string;
  image?: string;
  priceFromCents?: number;
}

export interface StudiosFile {
  generatedAt: string;
  source: string;
  studios: PublicStudio[];
}

export const statusText = (s: PublicStudio): string =>
  s.statusLabel ?? (s.status === 'open' ? 'Jetzt buchbar' : 'Eröffnet bald');

export const kindText = (s: PublicStudio): string => (s.kind === 'cube' ? 'BCube' : 'Partnerstudio');
