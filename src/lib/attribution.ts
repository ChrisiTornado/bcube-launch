/**
 * Erfasst UTM-Parameter, Referrer und Landing-Pfad beim ersten Seitenaufruf.
 * Bewusst NUR im Arbeitsspeicher: kein Cookie/Storage => kein Endgerätezugriff
 * nach § 165 Abs. 3 TKG 2021 und kein Einwilligungsbanner nötig. Das Formular liegt
 * auf derselben Seite, die Attribution bleibt also bis zum Absenden erhalten.
 */

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export interface Attribution {
  utm: Partial<Record<UtmKey, string>>;
  referrer: string;
  landingPath: string;
}

let captured: Attribution | null = null;

const clip = (value: string, max = 150) => value.trim().slice(0, max);

export function parseAttribution(href: string, referrer: string): Attribution {
  const url = new URL(href);
  const utm: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(key);
    if (value) utm[key] = clip(value);
  }
  let ref = '';
  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      // Nur Herkunft ohne Pfad/Query (kann personenbezogene Daten enthalten), eigene Domain ignorieren.
      if (refUrl.host !== url.host) ref = refUrl.origin;
    } catch {
      ref = '';
    }
  }
  return { utm, referrer: ref, landingPath: clip(url.pathname, 200) };
}

export function captureAttribution(): Attribution {
  if (!captured) {
    captured = parseAttribution(window.location.href, document.referrer);
  }
  return captured;
}

export function getAttribution(): Attribution {
  return captured ?? captureAttribution();
}
