/**
 * Client-Logik für alle Vormerk-Formulare ([data-waitlist-form]).
 * Validierung, Turnstile (lazy), Absenden an /api/lead, Tracking.
 */
import { getAttribution } from './attribution';
import { CONTACT_EMAIL, config } from './config';
import { OPERATOR_ROLE } from './roles';
import { track, trackOnce } from './track';

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type FieldErrors = Partial<Record<'email' | 'role' | 'consent' | 'name' | 'city' | 'studioName' | 'studioWebsite', string>>;

export interface LeadFormValues {
  email: string;
  name: string;
  role: string;
  city: string;
  consent: boolean;
  studioName: string;
  studioCity: string;
  studioType: string;
  studioWebsite: string;
}

/** Reine Validierungsfunktion (auch in Unit-Tests genutzt). Meldungen auf Deutsch. */
export function validateLead(v: LeadFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const email = v.email.trim();
  if (!email) errors.email = 'Bitte gib deine E-Mail-Adresse ein.';
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
  if (!v.role) errors.role = 'Bitte wähle aus, was am besten auf dich zutrifft.';
  if (v.name.trim().length > 80) errors.name = 'Bitte höchstens 80 Zeichen.';
  if (v.city.trim().length > 60) errors.city = 'Bitte höchstens 60 Zeichen.';
  if (v.role === OPERATOR_ROLE) {
    if (!v.studioName.trim()) errors.studioName = 'Bitte gib den Namen deines Studios an.';
    else if (v.studioName.trim().length > 80) errors.studioName = 'Bitte höchstens 80 Zeichen.';
    const site = v.studioWebsite.trim();
    if (site && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(site)) errors.studioWebsite = 'Bitte eine Adresse wie https://dein-studio.at angeben.';
  }
  if (!v.consent) errors.consent = 'Bitte bestätige die Einwilligung, damit wir uns bei dir melden dürfen.';
  return errors;
}

let turnstileLoading: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  turnstileLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile_load_failed'));
    document.head.appendChild(s);
  });
  return turnstileLoading;
}

function initForm(form: HTMLFormElement): void {
  const formId = form.dataset.formId || 'waitlist';
  const startedAt = Date.now();
  const status = form.querySelector<HTMLElement>('[data-form-status]')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const roleField = form.elements.namedItem('role') as HTMLSelectElement | HTMLInputElement;
  // Die Zielgruppe ist pro Formular fest (customer: Vormerkung, operator: Partnerstudio-Anfrage).
  const audience = (form.dataset.audience === 'operator' ? 'operator' : 'customer') as 'customer' | 'operator';
  const turnstileBox = form.querySelector<HTMLElement>('[data-turnstile]');
  const success = form.parentElement?.querySelector<HTMLElement>('[data-form-success]');

  let turnstileId: string | undefined;
  let token = '';
  let tokenWaiters: Array<(t: string) => void> = [];

  const setToken = (t: string) => {
    token = t;
    tokenWaiters.forEach((w) => w(t));
    tokenWaiters = [];
  };

  const ensureTurnstile = async () => {
    if (!config.turnstileSiteKey || !turnstileBox || turnstileId !== undefined) return;
    try {
      await loadTurnstile();
      turnstileId = window.turnstile!.render(turnstileBox, {
        sitekey: config.turnstileSiteKey,
        appearance: 'interaction-only',
        language: 'de',
        theme: 'dark',
        action: formId,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      });
    } catch {
      track('form_error', { form_id: formId, error_type: 'turnstile' });
    }
  };

  const waitForToken = (ms = 10000): Promise<string> => {
    if (!config.turnstileSiteKey) return Promise.resolve('');
    if (token) return Promise.resolve(token);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(''), ms);
      tokenWaiters.push((t) => {
        clearTimeout(timer);
        resolve(t);
      });
    });
  };

  const onStart = () => {
    trackOnce(`form_start_${formId}`, 'form_start', { form_id: formId, audience });
    void ensureTurnstile();
  };
  form.addEventListener('focusin', onStart, { once: true });
  form.addEventListener('input', onStart, { once: true });

  // Fehlermeldung eines Feldes entfernen, sobald es korrigiert wird.
  const clearFieldError = (event: Event) => {
    const input = event.target as HTMLInputElement | null;
    if (!input?.name || input.getAttribute('aria-invalid') !== 'true') return;
    const el = form.querySelector<HTMLElement>(`[data-error-for="${input.name}"]`);
    if (el) el.textContent = '';
    input.setAttribute('aria-invalid', 'false');
  };
  form.addEventListener('input', clearFieldError);
  form.addEventListener('change', clearFieldError);

  const values = (): LeadFormValues => {
    const fd = new FormData(form);
    const s = (k: string) => String(fd.get(k) ?? '');
    return {
      email: s('email'),
      name: s('name'),
      role: roleField.value,
      city: s('city'),
      consent: fd.get('consent') === 'on',
      studioName: s('studioName'),
      studioCity: s('studioCity'),
      studioType: s('studioType'),
      studioWebsite: s('studioWebsite'),
    };
  };

  const showErrors = (errors: FieldErrors) => {
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
      const field = el.dataset.errorFor as keyof FieldErrors;
      const msg = errors[field];
      el.textContent = msg ?? '';
      const input = form.elements.namedItem(field) as HTMLInputElement | null;
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
    const first = Object.keys(errors)[0];
    if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus();
  };

  const setStatus = (msg: string, kind: 'error' | 'info' | '' = '') => {
    status.textContent = msg;
    status.dataset.kind = kind;
  };

  const setBusy = (busy: boolean) => {
    submitBtn.disabled = busy;
    submitBtn.setAttribute('aria-busy', String(busy));
    submitBtn.querySelector('[data-label]')!.textContent = busy ? 'Wird gesendet …' : submitBtn.dataset.label!;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');
    const v = values();
    const errors = validateLead(v);
    showErrors(errors);
    if (Object.keys(errors).length > 0) {
      track('form_error', { form_id: formId, error_type: 'validation', field: Object.keys(errors).join(',') });
      return;
    }

    track('form_submit', { form_id: formId, role: v.role, audience, has_city: !!v.city.trim(), has_name: !!v.name.trim() });
    setBusy(true);

    try {
      await ensureTurnstile();
      const turnstileToken = await waitForToken();
      if (config.turnstileSiteKey && !turnstileToken) {
        setStatus('Die Sicherheitsprüfung konnte nicht abgeschlossen werden. Bitte versuch es noch einmal.', 'error');
        track('form_error', { form_id: formId, error_type: 'turnstile' });
        return;
      }

      const attribution = getAttribution();
      const fd = new FormData(form);
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: v.email.trim(),
          name: v.name.trim() || undefined,
          role: v.role,
          city: v.city.trim() || undefined,
          consent: v.consent,
          operator:
            v.role === OPERATOR_ROLE
              ? {
                  studioName: v.studioName.trim() || undefined,
                  studioCity: v.studioCity.trim() || undefined,
                  studioType: v.studioType || undefined,
                  website: v.studioWebsite.trim() || undefined,
                }
              : undefined,
          turnstileToken,
          company_website: String(fd.get('company_website') ?? ''),
          elapsedMs: Date.now() - startedAt,
          formId,
          ctaLocation: form.dataset.ctaLocation,
          attribution: { ...attribution.utm, referrer: attribution.referrer || undefined, landing_path: attribution.landingPath },
        }),
      });

      if (res.ok) {
        track('form_success', { form_id: formId, role: v.role, audience });
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus();
        }
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { error?: string; fields?: FieldErrors };
      if (res.status === 400 && body.fields) {
        showErrors(body.fields);
        track('form_error', { form_id: formId, error_type: 'validation', field: Object.keys(body.fields).join(',') });
      } else if (res.status === 429) {
        setStatus('Zu viele Versuche in kurzer Zeit. Bitte warte ein paar Minuten.', 'error');
        track('form_error', { form_id: formId, error_type: 'rate_limit' });
      } else if (body.error === 'turnstile') {
        setStatus('Die Sicherheitsprüfung ist fehlgeschlagen. Bitte lade die Seite neu und versuch es noch einmal.', 'error');
        track('form_error', { form_id: formId, error_type: 'turnstile' });
      } else {
        setStatus(`Da ist etwas schiefgelaufen. Bitte versuch es später noch einmal oder schreib uns an ${CONTACT_EMAIL}.`, 'error');
        track('form_error', { form_id: formId, error_type: 'server', status: res.status });
      }
    } catch {
      setStatus('Keine Verbindung. Bitte prüfe dein Internet und versuch es noch einmal.', 'error');
      track('form_error', { form_id: formId, error_type: 'network' });
    } finally {
      setBusy(false);
      if (turnstileId !== undefined) {
        window.turnstile?.reset(turnstileId);
        token = '';
      }
    }
  });
}

export function initWaitlistForms(): void {
  document.querySelectorAll<HTMLFormElement>('form[data-waitlist-form]').forEach(initForm);
}
