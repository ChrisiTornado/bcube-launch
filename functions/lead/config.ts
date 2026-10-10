import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

export interface RuntimeConfig {
  stage: string;
  siteUrl: string;
  mailFrom: string;
  mailReplyTo?: string;
  notifyEmail?: string;
  turnstileSecret: string;
  turnstileBypass: boolean;
  ipHashSalt: string;
  consentVersion: string;
  tableName?: string;
  sesConfigurationSet?: string;
}

const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Umgebungsvariable ${name} fehlt`);
  if (value === 'CHANGE_ME') throw new Error(`${name} ist noch der Platzhalter CHANGE_ME (SSM-Parameter setzen)`);
  return value;
};

let cached: RuntimeConfig | undefined;

/**
 * Lädt die Konfiguration. Geheimnisse (Turnstile-Secret, IP-Salt) kommen in AWS aus dem
 * SSM Parameter Store (TURNSTILE_SECRET_PARAM / IP_HASH_SALT_PARAM), lokal direkt aus .env.
 */
export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<RuntimeConfig> {
  if (cached) return cached;
  let turnstileSecret = env.TURNSTILE_SECRET;
  let ipHashSalt = env.IP_HASH_SALT;

  const params = [env.TURNSTILE_SECRET_PARAM, env.IP_HASH_SALT_PARAM].filter(Boolean) as string[];
  if (params.length) {
    const ssm = new SSMClient({});
    const res = await ssm.send(new GetParametersCommand({ Names: params, WithDecryption: true }));
    const byName = new Map((res.Parameters ?? []).map((p) => [p.Name, p.Value]));
    if (env.TURNSTILE_SECRET_PARAM) turnstileSecret = byName.get(env.TURNSTILE_SECRET_PARAM);
    if (env.IP_HASH_SALT_PARAM) ipHashSalt = byName.get(env.IP_HASH_SALT_PARAM);
  }

  const stage = env.STAGE ?? 'prod';
  cached = {
    stage,
    siteUrl: required('SITE_URL', env.SITE_URL).replace(/\/$/, ''),
    mailFrom: required('MAIL_FROM', env.MAIL_FROM),
    mailReplyTo: env.MAIL_REPLY_TO || undefined,
    notifyEmail: env.NOTIFY_EMAIL || undefined,
    turnstileSecret: required('TURNSTILE_SECRET', turnstileSecret),
    // Bypass ist ausschließlich lokal erlaubt.
    turnstileBypass: stage === 'local' && env.TURNSTILE_BYPASS === 'true',
    ipHashSalt: required('IP_HASH_SALT', ipHashSalt),
    consentVersion: env.CONSENT_VERSION ?? 'unversioned',
    tableName: env.TABLE_NAME,
    sesConfigurationSet: env.SES_CONFIGURATION_SET || undefined,
  };
  return cached;
}

export function resetConfigCache(): void {
  cached = undefined;
}
