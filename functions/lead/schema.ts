import { z } from 'zod';
import { ROLE_VALUES, STUDIO_TYPE_VALUES } from '../../src/lib/roles.ts';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const utmValue = optionalText(150);

const baseLeadSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ message: 'Bitte gib eine gültige E-Mail-Adresse ein.' })),
  name: optionalText(80),
  role: z.enum(ROLE_VALUES, { message: 'Bitte wähle aus, was am besten auf dich zutrifft.' }),
  city: optionalText(60),
  consent: z.literal(true, { message: 'Bitte bestätige die Einwilligung.' }),
  operator: z
    .object({
      studioName: optionalText(80),
      studioCity: optionalText(60),
      studioType: z.enum(STUDIO_TYPE_VALUES).optional(),
      website: z
        .string()
        .trim()
        .max(200)
        .regex(/^https?:\/\/\S+\.\S{2,}$/i, { message: 'Bitte eine Adresse wie https://dein-studio.at angeben.' })
        .optional(),
    })
    .optional(),
  turnstileToken: z.string().max(4096).optional().default(''),
  company_website: z.string().max(500).optional().default(''),
  elapsedMs: z.number().int().nonnegative().optional(),
  formId: z.enum(['waitlist_main', 'partner_main']).optional(),
  ctaLocation: optionalText(40),
  attribution: z
    .object({
      utm_source: utmValue,
      utm_medium: utmValue,
      utm_campaign: utmValue,
      utm_content: utmValue,
      utm_term: utmValue,
      referrer: optionalText(200),
      landing_path: optionalText(200),
    })
    .prefault({}),
});

/** Betreiber:innen müssen den Namen ihres Studios angeben (sonst ist die Anfrage nicht verwertbar). */
export const leadRequestSchema = baseLeadSchema.superRefine((v, ctx) => {
  if (v.role === 'betreiber' && !v.operator?.studioName) {
    ctx.addIssue({ code: 'custom', path: ['operator', 'studioName'], message: 'Bitte gib den Namen deines Studios an.' });
  }
});

export type LeadRequest = z.infer<typeof leadRequestSchema>;

/** Zod-Fehler auf Formularfelder abbilden (Namen wie im Frontend). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const [first, second] = issue.path as string[];
    const key = first === 'operator' ? (second === 'website' ? 'studioWebsite' : second === 'studioName' ? 'studioName' : 'role') : String(first);
    if (!map[key]) map[key] = issue.message.startsWith('Bitte') ? issue.message : 'Bitte überprüfe dieses Feld.';
  }
  return map;
}
