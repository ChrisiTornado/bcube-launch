import { LAUNCH_DATE_LABEL, CONTACT_EMAIL } from '../lib/config';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/** FAQ-Texte. Antworten als einfaches HTML (nur <a>, <strong>). */
export const faq: FaqItem[] = [
  {
    id: 'was_ist_cube',
    question: 'Was ist ein Cube?',
    answer:
      'Ein Cube ist ein kompaktes, mobiles Recording-Studio aus Massivholz – akustisch optimiert, mit Profi-Equipment ausgestattet und rund um die Uhr per Code zugänglich. Wir stellen Cubes an gut erreichbaren Orten in der Stadt auf.',
  },
  {
    id: 'kosten',
    question: 'Was kostet eine Session?',
    answer:
      'Geplant sind <strong>20 € pro Stunde</strong>, für Studierende <strong>10 € pro Stunde</strong>. Möglich wird das durch Werbepartner, die einen Großteil der Kosten tragen. Die finalen Preise veröffentlichen wir zum Start.',
  },
  {
    id: 'gratis_session',
    question: 'Wie bekomme ich die Gratis-Session?',
    answer:
      'Merk dich als Kund:in vor und bestätige deine E-Mail-Adresse über den Link, den wir dir schicken. Zum Start bekommst du einen Gutscheincode für eine 4-Stunden-Session in einem BCube. Die Gratis-Session gilt nicht für Studiobetreiber:innen. Details stehen in den <a href="/teilnahmebedingungen/">Teilnahmebedingungen</a>.',
  },
  {
    id: 'equipment',
    question: 'Welches Equipment steht im Cube?',
    answer:
      'Hardware im Wert von rund 30.000 €, darunter Mikrofone wie das Neumann U87 Ai und das FLEA 47, DAD-Interfaces und Studiomonitore. Eine genaue Ausstattungsliste pro Standort veröffentlichen wir vor dem Start. Eigene Instrumente und Laptops kannst du natürlich mitbringen.',
  },
  {
    id: 'zutritt',
    question: 'Wie komme ich in den Cube?',
    answer:
      'Nach der Buchung erhältst du einen persönlichen Zutrittscode. Damit öffnest du das Smartlock zu deiner gebuchten Zeit – ohne Schlüsselübergabe und ohne Wartezeit.',
  },
  {
    id: 'stornieren',
    question: 'Kann ich eine Buchung stornieren?',
    answer: 'Ja. Buchungen lassen sich in der App stornieren. Die genauen Storno-Fristen findest du zum Start in unseren AGB.',
  },
  {
    id: 'studio_eintragen',
    question: 'Ich betreibe ein Studio. Kann ich es auf BCube anbieten?',
    answer:
      'Ja! Neben unseren eigenen Cubes werden auch Partnerstudios auf der Plattform und auf der Karte sichtbar sein. Nutze dafür das Formular im Abschnitt „Für Studiobetreiber:innen“ weiter unten auf dieser Seite, wir melden uns persönlich bei dir. Die Gratis-Session ist ein Angebot für Kund:innen und gilt nicht für Partnerstudios.',
  },
  {
    id: 'start',
    question: 'Wann geht es los?',
    answer: `Am <strong>${LAUNCH_DATE_LABEL}</strong> starten wir in Wien. Vorgemerkte erfahren es zuerst.`,
  },
  {
    id: 'daten',
    question: 'Was passiert mit meinen Daten?',
    answer: `Wir nutzen deine Angaben nur, um dich über den Start von BCube zu informieren und dir deinen Gutschein zu schicken. Keine Weitergabe, kein Tracking per Cookies. Abmelden kannst du dich jederzeit über den Link in jeder E-Mail oder per Mail an <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. Mehr in der <a href="/datenschutz/">Datenschutzerklärung</a>.`,
  },
];
