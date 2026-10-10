/** Öffentliche Build-Konfiguration (PUBLIC_*). Niemals Geheimnisse hier ablegen. */
export const config = {
  siteUrl: import.meta.env.PUBLIC_SITE_URL || 'https://bcube.at',
  plausibleDomain: import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN || '',
  plausibleSrc: import.meta.env.PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js',
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '',
  mapPmtilesUrl: import.meta.env.PUBLIC_MAP_PMTILES_URL || '',
  showSocialProof: import.meta.env.PUBLIC_SHOW_SOCIAL_PROOF === 'true',
  leadCount: Number(import.meta.env.PUBLIC_LEAD_COUNT || 0),
};

export const LAUNCH_DATE_ISO = '2027-02-01';
export const LAUNCH_DATE_LABEL = '1. Februar 2027';
export const CONTACT_EMAIL = 'hallo@bcube.at';
