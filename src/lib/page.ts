/** Seitenweite Initialisierung: Attribution, Tracking-Listener, Formulare, Lazy-Karte. */
import { captureAttribution } from './attribution';
import { config } from './config';
import { initWaitlistForms } from './form';
import type { PublicStudio } from './studios';
import { track, trackOnce } from './track';

function initCtaTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest<HTMLAnchorElement | HTMLButtonElement>('[data-cta-id], a[href]');
    if (!link) return;

    const ctaId = link.dataset.ctaId;
    if (ctaId) {
      track('cta_click', {
        cta_id: ctaId,
        location: link.dataset.ctaLocation ?? 'unknown',
        audience: link.dataset.ctaAudience === 'operator' ? 'operator' : 'customer',
      });
      return;
    }

    if (link instanceof HTMLAnchorElement && link.href) {
      try {
        const url = new URL(link.href);
        if (/^https?:$/.test(url.protocol) && url.host !== window.location.host) {
          track('outbound_click', { url_host: url.host, location: link.closest('[data-section]')?.getAttribute('data-section') ?? 'unknown' });
        } else if (url.protocol === 'mailto:') {
          track('outbound_click', { url_host: 'mailto', location: link.closest('[data-section]')?.getAttribute('data-section') ?? 'unknown' });
        }
      } catch {
        /* ungültige URL ignorieren */
      }
    }
  });
}

function initScrollDepth(): void {
  const marks = [25, 50, 75, 100];
  let ticking = false;
  const check = () => {
    ticking = false;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const pct = scrollable <= 0 ? 100 : ((window.scrollY + 1) / scrollable) * 100;
    for (const m of marks) {
      if (pct >= m) trackOnce(`scroll_${m}`, 'scroll_depth', { depth: m });
    }
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(check);
      }
    },
    { passive: true },
  );
}

function initSectionViews(): void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const name = (e.target as HTMLElement).dataset.section!;
          trackOnce(`section_${name}`, 'section_view', { section: name });
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.5 },
  );
  document.querySelectorAll('[data-section]').forEach((el) => io.observe(el));
}

function initFaq(): void {
  document.querySelectorAll<HTMLDetailsElement>('details[data-faq-id]').forEach((d) => {
    d.addEventListener('toggle', () => {
      if (d.open) track('faq_open', { question_id: d.dataset.faqId! });
    });
  });
}

function initMap(): void {
  const root = document.querySelector<HTMLElement>('[data-studio-map]');
  if (!root) return;
  const canvas = root.querySelector<HTMLElement>('[data-map-canvas]')!;
  const studios = JSON.parse(root.querySelector('script[type="application/json"]')!.textContent || '[]') as PublicStudio[];
  let api: { focus(slug: string): void; destroy(): void; loaded: Promise<void> } | null = null;
  let loading: Promise<void> | null = null;
  const LOAD_TIMEOUT_MS = 12000;

  /** Wartet auf das Laden der Karte. Der Countdown läuft nur, solange der Tab sichtbar ist
   * (Browser pausieren das Rendering in Hintergrund-Tabs, dann kommt 'load' erst später). */
  const waitForLoad = (loaded: Promise<void>, ms: number): Promise<void> =>
    new Promise((resolve, reject) => {
      let remaining = ms;
      let last = performance.now();
      const tick = setInterval(() => {
        const now = performance.now();
        if (!document.hidden) remaining -= now - last;
        last = now;
        if (remaining <= 0) {
          clearInterval(tick);
          reject(new Error('map_timeout'));
        }
      }, 500);
      loaded.then(() => {
        clearInterval(tick);
        resolve();
      });
    });

  const attempt = async () => {
    // Das Modul kann (z. B. nach einem Deployment oder Dev-Server-Reload) beim ersten Mal scheitern.
    let mod: typeof import('./map');
    try {
      mod = await import('./map');
    } catch {
      await new Promise((r) => setTimeout(r, 800));
      mod = await import('./map');
    }
    api?.destroy();
    canvas.querySelectorAll('.maplibregl-canvas-container, .maplibregl-control-container').forEach((el) => el.remove());
    api = await mod.createStudioMap({ container: canvas, studios, pmtilesUrl: config.mapPmtilesUrl || undefined });
    // Lädt die Karte doch noch (langsames Netz, Tab war im Hintergrund), verschwindet die Fehlermeldung wieder.
    void api.loaded.then(() => {
      root.dataset.state = 'ready';
    });
    await waitForLoad(api.loaded, LOAD_TIMEOUT_MS);
  };

  const load = (): Promise<void> => {
    loading ??= attempt()
      .then(() => {
        root.dataset.state = 'ready';
      })
      .catch((err: unknown) => {
        console.error('[map] Karte konnte nicht geladen werden:', err);
        if (root.dataset.state !== 'ready') root.dataset.state = 'error';
        loading = null; // erneuter Versuch möglich
        track('map_interaction', { action: 'load_failed', reason: err instanceof Error ? err.message.slice(0, 60) : 'unknown' });
      });
    return loading;
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void load();
      }
    },
    { rootMargin: '300px 0px' },
  );
  io.observe(root);

  root.querySelector<HTMLButtonElement>('[data-map-retry]')?.addEventListener('click', () => {
    root.dataset.state = 'idle';
    void load();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-focus-studio]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await load();
      api?.focus(btn.dataset.focusStudio!);
      canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

function initHeader(): void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/** Warteschlange, damit Events vor dem Laden des Plausible-Scripts nicht verloren gehen. */
function initPlausibleQueue(): void {
  if (typeof window.plausible === 'function') return;
  const queue: unknown[] = [];
  const fn = ((...args: unknown[]) => {
    queue.push(args);
  }) as NonNullable<Window['plausible']>;
  fn.q = queue;
  window.plausible = fn;
}

/** Betreiber-Formular ist eingeklappt: Button und Links mit data-open-operator-form klappen es auf. */
function initOperatorForm(): void {
  const wrap = document.querySelector<HTMLElement>('[data-operator-form]');
  if (!wrap) return;
  const toggle = document.querySelector<HTMLButtonElement>('[data-operator-toggle]');

  const open = (focus: boolean) => {
    wrap.hidden = false;
    toggle?.setAttribute('aria-expanded', 'true');
    toggle?.setAttribute('hidden', '');
    if (focus) wrap.querySelector<HTMLInputElement>('input[name="email"]')?.focus({ preventScroll: true });
  };

  toggle?.addEventListener('click', () => open(true));
  document.querySelectorAll<HTMLAnchorElement>('a[data-open-operator-form]').forEach((a) =>
    a.addEventListener('click', () => open(false)),
  );
  // Direktaufruf mit #studios-formular öffnet das Formular ebenfalls
  if (window.location.hash === '#studios-formular') open(false);
}

export function initPage(): void {
  if (config.plausibleDomain) initPlausibleQueue();
  captureAttribution();
  track('page_view', { path: window.location.pathname });
  initCtaTracking();
  initScrollDepth();
  initSectionViews();
  initFaq();
  initHeader();
  initWaitlistForms();
  initOperatorForm();
  initMap();
}
