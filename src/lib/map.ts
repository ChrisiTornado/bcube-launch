/**
 * Studiokarte mit MapLibre GL (BSD-Lizenz, kein API-Key).
 * Kacheln: selbst gehostete Protomaps-PMTiles (PUBLIC_MAP_PMTILES_URL) – keine Drittanbieter-
 * Anfragen. Ohne PMTiles-URL fällt die Karte auf OpenFreeMap zurück (gratis, ohne SLA).
 * Diese Datei wird erst dynamisch geladen, wenn die Karte in den Viewport scrollt.
 */
import maplibregl, { type Map as MlMap, type Marker, type Popup, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PublicStudio } from './studios';
import { kindText, statusText } from './studios';
import { track, trackOnce } from './track';

const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende';
const FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const DEFAULT_CENTER: [number, number] = [16.3738, 48.2082]; // Wien, wie in der App

export interface StudioMapOptions {
  container: HTMLElement;
  studios: PublicStudio[];
  pmtilesUrl?: string;
  /** Basis-URL für Glyphs/Sprites der Protomaps-Styles (Standard: selbst gehostet unter /map-assets). */
  assetsUrl?: string;
}

export interface StudioMapApi {
  focus(slug: string): void;
  destroy(): void;
  /** Resolved, sobald Stil und erste Kacheln geladen sind (Ereignis 'load'). */
  loaded: Promise<void>;
}

const POPUP_TIP_OFFSET = 40; // Abstand Popup-Unterkante zur Marker-Unterkante (siehe Popup-Option offset)
const POPUP_MARGIN = 12;

async function buildStyle(pmtilesUrl: string, assetsUrl: string): Promise<StyleSpecification> {
  const [{ Protocol }, basemaps] = await Promise.all([import('pmtiles'), import('@protomaps/basemaps')]);
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  // Protomaps "dark" mit bcube-Akzenten: Straßen leicht warm, Wasser tiefschwarz-blau.
  const flavor = { ...basemaps.namedFlavor('dark'), background: '#0b0b0b', earth: '#141414', water: '#0d1117' };
  return {
    version: 8,
    glyphs: `${assetsUrl}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsUrl}/sprites/v4/dark`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: `<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> ${OSM_ATTRIBUTION}`,
      },
    },
    layers: basemaps.layers('protomaps', flavor, { lang: 'de' }),
  } as StyleSpecification;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function popupHtml(s: PublicStudio): string {
  const address = [s.street, [s.plz, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return `
    <article class="map-popup">
      ${s.image ? `<img src="${escapeHtml(s.image)}" alt="" width="320" height="200" loading="lazy" />` : ''}
      <div class="map-popup__body">
        <p class="map-popup__meta"><span class="map-popup__kind map-popup__kind--${s.kind}">${kindText(s)}</span> ${escapeHtml(statusText(s))}</p>
        <h3>${escapeHtml(s.name)}</h3>
        ${address ? `<p class="map-popup__address">${escapeHtml(address)}</p>` : ''}
        ${s.teaser ? `<p class="map-popup__teaser">${escapeHtml(s.teaser)}</p>` : ''}
        <a class="btn btn-primary map-popup__cta" href="#vormerken" data-cta-id="map_popup" data-cta-location="map">Gratis-Session sichern</a>
      </div>
    </article>`;
}

function markerElement(s: PublicStudio): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `map-marker map-marker--${s.kind}`;
  el.setAttribute('aria-label', `${s.name} – ${kindText(s)}, ${statusText(s)}`);
  // Würfel-Pin im Stil des Logos
  el.innerHTML = `<svg viewBox="0 0 32 40" aria-hidden="true"><path class="map-marker__pin" d="M16 39s13-12.4 13-23A13 13 0 0 0 3 16c0 10.6 13 23 13 23Z"/><path class="map-marker__cube" d="m16 8 7 4v8l-7 4-7-4v-8l7-4Zm0 2.3-5 2.9 5 2.9 5-2.9-5-2.9Z"/></svg>`;
  return el;
}

export async function createStudioMap(opts: StudioMapOptions): Promise<StudioMapApi> {
  const { container, studios } = opts;
  const style = opts.pmtilesUrl ? await buildStyle(opts.pmtilesUrl, opts.assetsUrl ?? '/map-assets') : FALLBACK_STYLE;

  const map: MlMap = new maplibregl.Map({
    container,
    style,
    center: DEFAULT_CENTER,
    zoom: 9,
    minZoom: 5,
    maxZoom: 17,
    attributionControl: { compact: true, customAttribution: opts.pmtilesUrl ? undefined : OSM_ATTRIBUTION },
    // Auf dem Handy scrollt man mit einem Finger weiter durch die Seite, statt in der Karte hängen zu bleiben.
    cooperativeGestures: true,
    // Kein Zeitlimit für Kacheln: lieber langsam laden als abbrechen (Fehlerbehandlung unten).
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Strg + Scrollen zum Zoomen der Karte',
      'CooperativeGesturesHandler.MacHelpText': '⌘ + Scrollen zum Zoomen der Karte',
      'CooperativeGesturesHandler.MobileHelpText': 'Karte mit zwei Fingern bewegen',
      'NavigationControl.ZoomIn': 'Hineinzoomen',
      'NavigationControl.ZoomOut': 'Herauszoomen',
      'NavigationControl.ResetBearing': 'Nach Norden ausrichten',
      'Popup.Close': 'Schließen',
    },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  const markers = new Map<string, { marker: Marker; popup: Popup }>();
  for (const s of studios) {
    const popup = new maplibregl.Popup({ offset: [0, -40], maxWidth: '300px', closeButton: true, anchor: 'bottom' }).setHTML(popupHtml(s));
    const el = markerElement(s);
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([s.lng, s.lat]).setPopup(popup).addTo(map);
    el.addEventListener('click', () => {
      track('studio_marker_click', { studio_slug: s.slug, status: s.status, kind: s.kind, source: 'marker' });
    });
    // Beim Öffnen die Karte so verschieben, dass das komplette Popup im Kartenfenster liegt.
    popup.on('open', () => {
      // Der Marker soll so weit unten im Kartenfenster stehen, dass das gemessene Popup darüber vollständig Platz hat.
      const h = map.getContainer().clientHeight;
      const popupH = popup.getElement()?.offsetHeight ?? 340;
      const markerY = Math.min(h - 24, popupH + POPUP_TIP_OFFSET + POPUP_MARGIN);
      const offsetY = Math.max(0, Math.round(markerY - h / 2));
      map.easeTo({
        center: [s.lng, s.lat],
        zoom: Math.max(map.getZoom(), 13.5),
        offset: [0, offsetY],
        duration: 450,
        essential: true,
      });
    });
    markers.set(s.slug, { marker, popup });
  }

  const fit = () => {
    if (studios.length === 0) return;
    if (studios.length === 1) {
      map.jumpTo({ center: [studios[0].lng, studios[0].lat], zoom: 13 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    studios.forEach((s) => bounds.extend([s.lng, s.lat]));
    map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 50, right: 50 }, maxZoom: 13, duration: 0 });
  };

  let settle!: { resolve: () => void };
  const loaded = new Promise<void>((resolve) => {
    settle = { resolve };
  });

  map.on('load', () => {
    fit();
    settle.resolve();
    trackOnce('map_loaded', 'map_interaction', { action: 'loaded', tiles: opts.pmtilesUrl ? 'pmtiles' : 'openfreemap' });
  });
  // Einzelne Kachel-/Glyph-Fehler sind unkritisch; ob die Karte brauchbar ist, entscheidet das
  // Zeitlimit auf das 'load'-Ereignis (siehe page.ts). Hier nur für die Diagnose protokollieren.
  map.on('error', (e) => {
    if (!map.loaded()) console.warn('[map] Fehler beim Laden:', e.error?.message ?? e);
  });
  // Nur echte Nutzer-Gesten zählen (originalEvent), nicht programmatische Kamerafahrten.
  map.on('zoomstart', (e) => {
    if ((e as { originalEvent?: Event }).originalEvent) trackOnce('map_zoom', 'map_interaction', { action: 'zoom' });
  });
  map.on('dragstart', () => trackOnce('map_pan', 'map_interaction', { action: 'pan' }));

  return {
    loaded,
    focus(slug: string) {
      const entry = markers.get(slug);
      const s = studios.find((x) => x.slug === slug);
      if (!entry || !s) return;
      markers.forEach(({ popup }) => popup.remove());
      // Kamerafahrt übernimmt der "open"-Handler des Popups
      if (!entry.popup.isOpen()) entry.marker.togglePopup();
      track('map_interaction', { action: 'list_click', studio_slug: slug });
      track('studio_marker_click', { studio_slug: slug, status: s.status, kind: s.kind, source: 'list' });
    },
    destroy() {
      map.remove();
    },
  };
}
