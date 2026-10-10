/**
 * Einwilligungstexte der Vormerkung. Bei jeder inhaltlichen Änderung CONSENT_VERSION erhöhen
 * (Umgebungsvariable der Funktion), damit der Nachweis nach Art. 7 DSGVO eindeutig bleibt.
 *
 * Es gibt zwei Texte: Kund:innen (Musiker:innen, Bands, Producer:innen …) bekommen die Gratis-Session,
 * Studiobetreiber:innen nicht – für sie geht es nur um ein Gespräch über eine Partnerschaft.
 * Der Link zur Datenschutzerklärung steht im Formular hinter dem Wort "Datenschutzerklärung".
 */
export const CONSENT_TEXT =
  'Ich möchte per E-Mail informiert werden, wenn BCube startet, und erhalte meinen Gutschein für die Gratis-Session. ' +
  'Ich stimme der Verarbeitung meiner Angaben gemäß der Datenschutzerklärung zu. Abmeldung jederzeit über den Link in jeder E-Mail.';

export const CONSENT_TEXT_OPERATOR =
  'Ich möchte, dass sich BCube per E-Mail bei mir meldet, um über mein Studio als Partnerstudio zu sprechen. ' +
  'Ich stimme der Verarbeitung meiner Angaben gemäß der Datenschutzerklärung zu. Abmeldung jederzeit über den Link in jeder E-Mail.';

export const consentTextFor = (role: string): string => (role === 'betreiber' ? CONSENT_TEXT_OPERATOR : CONSENT_TEXT);
