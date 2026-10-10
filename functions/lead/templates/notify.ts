import type { Lead } from '../types.ts';
import { escapeHtml, h1, layout, p } from './layout.ts';

/** Interne Benachrichtigung über eine neu bestätigte Vormerkung. */
export function notifyMail(lead: Lead, siteUrl: string) {
  const rows: [string, string | undefined][] = [
    ['E-Mail', lead.email],
    ['Name', lead.name],
    ['Rolle', lead.role],
    ['Wunsch-Standort', lead.city],
    ['Studio', lead.operator?.studioName],
    ['Studio-Ort', lead.operator?.studioCity],
    ['Studio-Art', lead.operator?.studioType],
    ['Website', lead.operator?.website],
    ['Formular', [lead.formId, lead.ctaLocation].filter(Boolean).join(' / ')],
    ['utm_source', lead.attribution.utm_source],
    ['utm_medium', lead.attribution.utm_medium],
    ['utm_campaign', lead.attribution.utm_campaign],
    ['utm_content', lead.attribution.utm_content],
    ['Referrer', lead.attribution.referrer],
    ['Eingetragen', lead.createdAt],
    ['Bestätigt', lead.confirmedAt],
  ];
  const filled = rows.filter(([, v]) => v);
  const table = `<table role="presentation" cellpadding="6" cellspacing="0" border="0" style="width:100%;font-family:Arial,sans-serif;font-size:14px;color:#fff;">${filled
    .map(([k, v]) => `<tr><td style="color:#bdbdbd;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('')}</table>`;

  const label = lead.role === 'betreiber' ? 'Neues Partnerstudio-Interesse' : 'Neue bestätigte Vormerkung';
  return {
    subject: `${label}: ${lead.role}${lead.city ? ` (${lead.city})` : ''}`,
    html: layout({ siteUrl, preheader: `${label}: ${lead.email}`, body: [h1(label), p('Diese Vormerkung wurde soeben per Double Opt-in bestätigt.'), table].join('\n') }),
    text: [label, '', ...filled.map(([k, v]) => `${k}: ${v}`)].join('\n'),
  };
}
