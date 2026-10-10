import { button, colors, escapeHtml, h1, layout, p, small } from './layout.ts';

export interface DoiMailInput {
  siteUrl: string;
  name?: string;
  confirmUrl: string;
  unsubscribeUrl: string;
  isOperator: boolean;
}

export function doiMail({ siteUrl, name, confirmUrl, unsubscribeUrl, isOperator }: DoiMailInput) {
  const greeting = name ? `Hallo ${escapeHtml(name)},` : 'Hallo,';
  const subject = isOperator ? 'Bitte bestätige deine Anfrage als Partnerstudio bei BCube' : 'Bitte bestätige deine Vormerkung bei BCube';
  const intro = isOperator
    ? 'danke für dein Interesse, dein Studio auf BCube anzubieten. Bitte bestätige mit einem Klick, dass wir uns per E-Mail bei dir melden dürfen.'
    : 'danke für dein Interesse an BCube. Bitte bestätige mit einem Klick, dass wir dich per E-Mail informieren dürfen.';
  const introText = isOperator
    ? 'danke für dein Interesse, dein Studio auf BCube anzubieten. Bitte bestätige mit einem Klick, dass wir uns per E-Mail bei dir melden dürfen:'
    : 'danke für dein Interesse an BCube. Bitte bestätige mit einem Klick, dass wir dich per E-Mail informieren dürfen:';
  const buttonLabel = isOperator ? 'Anfrage bestätigen' : 'Vormerkung bestätigen';
  const offer = isOperator
    ? 'Danach melden wir uns persönlich bei dir, um über dein Studio auf BCube zu sprechen.'
    : 'Danach ist deine <strong>gratis 4-Stunden-Session</strong> gesichert – den Gutscheincode bekommst du zum Start am 1. Februar 2027.';
  const offerText = isOperator
    ? 'Danach melden wir uns persönlich bei dir, um über dein Studio auf BCube zu sprechen.'
    : 'Danach ist deine gratis 4-Stunden-Session gesichert – den Gutscheincode bekommst du zum Start am 1. Februar 2027.';

  const html = layout({
    siteUrl,
    preheader: isOperator ? 'Ein Klick noch – dann melden wir uns bei dir.' : 'Ein Klick noch – dann bist du dabei.',
    body: [
      h1('Fast geschafft!'),
      p(greeting),
      p(intro),
      button(confirmUrl, buttonLabel),
      p(offer, true),
      small(`Der Button funktioniert nicht? Kopiere diesen Link in deinen Browser:<br><a href="${escapeHtml(confirmUrl)}" style="color:${colors.orange};word-break:break-all;">${escapeHtml(confirmUrl)}</a>`),
      small('Der Link ist 30 Tage gültig. Du hast dich nicht angemeldet? Dann ignoriere diese E-Mail einfach – ohne Bestätigung löschen wir deine Daten automatisch nach 30 Tagen.'),
    ].join('\n'),
    footerExtra: small(`<a href="${escapeHtml(unsubscribeUrl)}" style="color:${colors.faint};">Daten löschen und abmelden</a>`),
  });

  const text = [
    'Fast geschafft!',
    '',
    name ? `Hallo ${name},` : 'Hallo,',
    '',
    introText,
    '',
    confirmUrl,
    '',
    offerText,
    '',
    'Der Link ist 30 Tage gültig. Du hast dich nicht angemeldet? Dann ignoriere diese E-Mail – ohne Bestätigung löschen wir deine Daten nach 30 Tagen.',
    '',
    `Abmelden und Daten löschen: ${unsubscribeUrl}`,
    '',
    `BCube · ${siteUrl}/impressum/`,
  ].join('\n');

  return { subject, html, text };
}
