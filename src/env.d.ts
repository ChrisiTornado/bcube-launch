interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_PLAUSIBLE_DOMAIN?: string;
  readonly PUBLIC_PLAUSIBLE_SRC?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_MAP_PMTILES_URL?: string;
  readonly PUBLIC_SHOW_SOCIAL_PROOF?: string;
  readonly PUBLIC_LEAD_COUNT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
