/** Gemeinsames E-Mail-Layout im BCube-Look (dunkel, Orange). Tabellen + Inline-Styles für Mail-Clients. */

export const escapeHtml = (value: string | undefined | null): string =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const C = {
  bg: '#0b0b0b',
  card: '#141414',
  line: '#3a2a12',
  orange: '#ffa722',
  ink: '#111111',
  text: '#ffffff',
  soft: '#bdbdbd',
  faint: '#8a8a8a',
};

const FONT = "'Avenir Next', Montserrat, 'Segoe UI', Arial, sans-serif";

export interface LayoutOptions {
  siteUrl: string;
  preheader: string;
  body: string;
  footerExtra?: string;
}

export function button(href: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td style="border-radius:16px;background:${C.orange};">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.ink};text-decoration:none;border-radius:16px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export const p = (html: string, muted = false) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${muted ? C.soft : C.text};">${html}</p>`;

export const small = (html: string) => `<p style="margin:0 0 12px;font-family:${FONT};font-size:13px;line-height:1.55;color:${C.faint};">${html}</p>`;

export const h1 = (text: string) =>
  `<h1 style="margin:0 0 20px;font-family:${FONT};font-size:26px;line-height:1.15;font-weight:800;letter-spacing:0.02em;text-transform:uppercase;color:${C.text};">${escapeHtml(text)}</h1>`;

export function layout({ siteUrl, preheader, body, footerExtra = '' }: LayoutOptions): string {
  const logo = `${siteUrl}/apple-touch-icon.png`;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>BCube</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:0 0 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td><img src="${escapeHtml(logo)}" width="40" height="40" alt="" style="display:block;border-radius:10px;border:1px solid ${C.line};"></td>
              <td style="padding-left:8px;font-family:${FONT};font-size:24px;font-weight:800;color:${C.text};">cube</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:${C.card};border:1px solid ${C.line};border-radius:24px;padding:32px 28px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;">
            ${footerExtra}
            ${small(`BCube · Musik braucht Raum – BCube macht Platz.<br><a href="${escapeHtml(siteUrl)}/impressum/" style="color:${C.faint};">Impressum</a> · <a href="${escapeHtml(siteUrl)}/datenschutz/" style="color:${C.faint};">Datenschutz</a>`)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export const colors = C;
