/**
 * Dünne Hülle um Plausible (cookielos). Alle Events laufen hier durch, damit
 * - nie personenbezogene Daten (E-Mail, Name, Freitext) in die Analyse gelangen,
 * - die Seite ohne Analytics-Script (lokal, Adblocker) fehlerfrei funktioniert,
 * - Events im Dev-Modus in der Konsole sichtbar sind.
 */

export type TrackProps = Record<string, string | number | boolean | undefined>;

export type EventName =
  | 'page_view'
  | 'cta_click'
  | 'form_start'
  | 'form_submit'
  | 'form_success'
  | 'form_error'
  | 'map_interaction'
  | 'studio_marker_click'
  | 'scroll_depth'
  | 'faq_open'
  | 'outbound_click'
  | 'section_view';

type PlausibleFn = ((event: string, options?: { props?: Record<string, string | number | boolean>; u?: string }) => void) & {
  q?: unknown[];
};

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

const BLOCKED_KEYS = /mail|name|phone|telefon|address|adresse|message|nachricht|website/i;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MAX_VALUE_LENGTH = 100;

export function sanitizeProps(props: TrackProps = {}): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === '') continue;
    if (BLOCKED_KEYS.test(key)) continue;
    if (typeof value === 'string') {
      if (EMAIL_LIKE.test(value)) continue;
      clean[key] = value.slice(0, MAX_VALUE_LENGTH);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function track(eventName: EventName, props?: TrackProps): void {
  const clean = sanitizeProps(props);
  try {
    if (import.meta.env.DEV) {
      console.info('[track]', eventName, clean);
    }
    // page_view übernimmt Plausible automatisch beim Laden des Scripts ("pageview").
    if (eventName === 'page_view') return;
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      window.plausible(eventName, { props: clean });
    }
  } catch {
    // Tracking darf die Seite nie stören.
  }
}

/** Feuert ein Event höchstens einmal pro Seitenaufruf und Schlüssel. */
const fired = new Set<string>();
export function trackOnce(key: string, eventName: EventName, props?: TrackProps): void {
  if (fired.has(key)) return;
  fired.add(key);
  track(eventName, props);
}
