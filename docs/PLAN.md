# BCube Launch One-Pager – Analyse und Plan (Phase 1)

Stand: 10.10.2026 · Status: **Entwurf, wartet auf Freigabe**

Grundlage: Analyse von `bcube/` (Angular-Frontend `bcube-web`, Spring-Services, iOS-App, Terraform, GitHub Actions). Im bestehenden Repository wurde nichts verändert.

---

## 0. Wichtigste Erkenntnisse auf einen Blick

| Thema | Befund | Konsequenz für die Launch-Seite |
| --- | --- | --- |
| Theme | Kein Tailwind-Config vorhanden (README erwähnt Tailwind, im Code gibt es keins). Das Theme steckt in CSS-Variablen in `bcube-web/src/styles.scss` plus PrimeNG Aura mit vielen Overrides. Nur Dark Mode. | Tokens 1:1 als CSS-Variablen übernehmen, kein PrimeNG nötig. |
| Schrift | Stack `"Avenir Next", "Montserrat", "Segoe UI", sans-serif`, aber **keine Webfont wird geladen**. Auf Windows/Android landet man bei Segoe UI bzw. Roboto. | Montserrat (OFL) selbst hosten, damit die Seite überall gleich aussieht und keine Google-Fonts-Verbindung entsteht. |
| Karte | Mapbox GL JS 3.x, per dynamischem Import nachgeladen, Style `streets-v12`, schwarze Standardmarker, **keine Popups** (Klick wählt die Karte in der Liste aus). Token im Code. | Für die Launch-Seite MapLibre plus selbst gehostete Kacheln, kein Key nötig (siehe Abschnitt 3). |
| Studiodaten | `GET /api/studios` ist öffentlich (`permitAll`). Antwort enthält aber auch `smartlockId`, interne `id`, `createdAt` und Bilder als Base64. Aktuell **ein** Studio (bcube Studio Hauptbahnhof, Wien). | Export-Skript mit Whitelist der Felder, Bilder als optimierte Dateien statt Base64. |
| Positionierung | Die UI spricht neutral von „Cubes“ und „Bcube Spots“. Die Seed-Beschreibung des einzigen Studios redet von **Trainingsgeräten und Yoga**, das Impressum von „kreativen, technischen und produktiven Anwendungen“, die README von Lern- und Arbeitsräumen an Unis. | Für die Kampagne die Musik-Positionierung klar setzen. Die Studiobeschreibung im Export **nicht** übernehmen, sondern einen eigenen Kampagnentext pflegen (siehe offene Fragen). |
| Cloud | AWS, Region `eu-central-1` (Frankfurt), Terraform (noch nicht angewendet), GitHub Actions mit OIDC-Rolle. Mails laufen aktuell über Gmail-SMTP. | AWS-Stack: S3 + CloudFront, Lambda, DynamoDB, SES, alles in `eu-central-1`. |
| Nebenbefund | Mapbox-Token (`pk.…`) und Stripe-Publishable-Key (`pk_test_…`) liegen in `environment*.ts` im Git. Beide sind öffentliche Schlüssel, sollten aber URL-beschränkt sein. Die `.env`-Dateien sind korrekt nicht eingecheckt. | Kein Handlungsbedarf für die Launch-Seite, nur als Hinweis. |

---

## 1. Analyse des bestehenden Systems

### 1a. Design-System

#### Farben

| Name | Hexwert | Verwendung |
| --- | --- | --- |
| `--bcube-orange` | `#FFA722` | Primärfarbe: Buttons, aktive Navigation, Fokusring, Kalender-Events, Sortier-Icons, Fehlertexte (`.p-error`) |
| `--bcube-orange-strong` | `#FFB53F` | Hover-Zustand für Primärbuttons |
| `--bcube-black` | `#0B0B0B` | Grundhintergrund (`surface-ground`), Ende des Hintergrundverlaufs |
| Text auf Orange | `#111111` | Schrift auf orangen Buttons, Marker-Farbe auf der Karte, Start des Hintergrundverlaufs |
| Verlauf Mitte | `#1A1A1A` | Mittlerer Stopp im Seitenhintergrund (Web und iOS) |
| Verlauf tief (iOS) | `#050505` | Unteres Ende des iOS-Hintergrunds |
| `--bcube-text` | `#FFFFFF` | Fließtext, Überschriften |
| `--bcube-text-soft` | `#FFFFFF` mit 72 % Deckkraft | Sekundärtext, Placeholder, Labels |
| `--bcube-panel` | `#121212` mit 88 % Deckkraft | Karten und Panels |
| `--bcube-panel-soft` | `#FFFFFF` mit 4 % Deckkraft | Leichte Flächen, Verlaufsoberkante in Karten |
| `--bcube-line` | `#FFA722` mit 22 % Deckkraft | Rahmen von Karten, Tabellen, Kalender |
| `--bcube-line-soft` | `#FFFFFF` mit 8 % Deckkraft | Trennlinien |
| Input-Rahmen | `#FFA722` mit 18 % (Hover 42 %, Fokus 100 % plus Ring mit 16 %) | Formularfelder |
| Outline-Button | Fläche `#FFA722` mit 8 %, Rahmen 28 % (Hover 16 % / 40 %) | Sekundärbuttons, Selects |
| Erfolg | `#5FE07B` | Status „erledigt“ bei Buchungen |
| Fehler | `#F38B8B` / `#F87171` | Zahlungs- und Gutscheinfehler, Status „fehlgeschlagen“ |
| Warmes Weiß | `#FFF8ED` / `#FFF6E8` | Vereinzelte helle Flächen auf Orange |

Hintergrund der Seite: zwei orange Radial-Glows (20 % und 16 %) links oben und rechts unten über einem Verlauf `#111111 → #1A1A1A → #0B0B0B` mit 135°.

#### Typografie

- Schrift: `"Avenir Next", "Montserrat", "Segoe UI", sans-serif` (iOS: SF Rounded)
- Gewichte: vor allem 700 und 800, Buttons 600, Fließtext 400
- Seitentitel H1: Großbuchstaben, 800, `letter-spacing: 0.06em`, `line-height: 1`, `clamp(1.7rem, 3vw, 2.4rem)`
- Tabellenköpfe und Eyebrows: Großbuchstaben, 0,78 rem, 800, `letter-spacing: 0.08em`
- Wortmarke: Logo-Würfel plus „cube“ in Kleinbuchstaben, sehr fett (iOS: 34 pt, black, rounded)

#### Abstände und Radien

- Abstände (iOS-Theme, im Web analog verwendet): 8 / 12 / 16 / 24 / 32 px
- Radien: Inputs und Buttons 16 px, Karten 24 px, große Panels 28 bis 30 px, Pills und Badges 999 px
- Schatten: `0 22px 60px rgba(0,0,0,.28)` für Panels, `0 12px 26px rgba(0,0,0,.16)` für Buttons

#### Buttons und Komponenten

- **Primär**: Fläche `#FFA722`, Text `#111111`, Radius 16 px, Gewicht 600, `letter-spacing: .02em`, Hover `#FFB53F`
- **Sekundär (outlined/text)**: Fläche Orange 8 %, Rahmen Orange 28 %, Text Weiß, Hover 16 % / 40 %
- **Inputs**: Fläche Weiß 6 %, Rahmen Orange 18 %, Radius 16 px, Fokus orange mit 4 px Ring
- **Karten**: Verlauf von Weiß 4 % nach Weiß 1,5 % über `rgba(15,15,15,.88)`, Rahmen `--bcube-line`, Radius 24 px
- **Studio-Card**: Bildergalerie mit Pfeilen und Punkten, Badge „Bcube Spot“, Titel, Adresse, Teaser, Meta „Flexible Sessions · Österreich“
- **Dialoge und Toasts**: dunkles Glas mit Blur, oranger Rahmen
- Bilder vorhanden: Logo `nice.jpg` (640×640, weißer Würfel mit „B“ auf Schwarz) und Renderings der Cubes (weißer Container mit Gründach in der Wiener Innenstadt, Innenansichten)

### 1b. Studiokarte im Bestand

| Aspekt | Umsetzung |
| --- | --- |
| Bibliothek | `mapbox-gl` ^3.28, per `import()` in eigenen Chunk ausgelagert, CSP-Worker als statisches Asset |
| Style | `mapbox://styles/mapbox/streets-v12`, Zoom 7,6 bis 15,2, Startpunkt Wien (16.3738, 48.2082) |
| Datenquelle | `StudioService` → `GET /api/studios` bzw. `/api/studios/page` (Spring `studio-service`, PostgreSQL, Felder `latitude`/`longitude`, Geocoding beim Anlegen) |
| Marker | Standard-Mapbox-Marker, Farbe `#111111`, Scale 1,15; ausgewählter Marker hebt sich mit weißem Glow und Versatz ab |
| Popups | Keine. Marker-Klick wählt die Studio-Card aus, Klick auf die Karte hebt die Auswahl auf. `fitBounds` auf alle Studios. |
| API-Key | Mapbox-Public-Token direkt in `environment.ts`, `environment.local.ts`, `environment.prod.ts` (im Git) |
| Robustheit | ResizeObserver, Watchdog mit Neuaufbau, Retry bei Style-Fehlern (Hinweis auf frühere „graue Karte“-Probleme) |

### 1c. Tonalität, Begriffe, Kernfunktionen

- **Ansprache**: durchgehend „du“, kurz, freundlich, sachlich („Wähle Datum und Zeit direkt hier aus und prüfe freie Slots im Kalender.“). Einzelne englische Einsprengsel („Over N Bcube spots in Vienna“, „Flexible Sessions“, „Users“).
- **Begriffe**: Cube, Cubes, Bcube Spot, Mein Cube, Cubeübersicht, Buchung, Buchungsnummer, Stornieren, Zutrittscode, Gutschein(code), Zahlungsverlauf, Rückerstattung, freie Slots, „Kommt bald“.
- **Kernfunktionen** (aus Code und AGB):
  1. **Entdecken**: Cubes auf Karte und Liste, Galerie, Details, Stundenpreis (Seed: 15 €/h)
  2. **Buchen**: Datum und Zeit wählen, Verfügbarkeiten im Kalender
  3. **Bezahlen**: Stripe-Kartenzahlung, Gutscheine, Rückerstattungen, Zahlungsverlauf
  4. **Zutritt**: persönlicher Zutrittscode, Nuki-Smartlock, Zugang rund um die Uhr ohne Schlüsselübergabe
  5. **Verwalten**: Buchungen ansehen und stornieren, Profil, Login mit E-Mail oder Google
  6. **Admin**: Cubes, Nutzer und Schlösser verwalten
- **Lücke**: Musikbezug (Proberaum, Aufnahme, Akustik, Equipment) kommt in der UI nicht vor. Die Seite muss ihn herstellen, ohne Ausstattung zu versprechen, die nicht bestätigt ist.

---

## 2. Seitenplan (One-Pager)

Navigation: schmale Sticky-Bar mit Logo plus „cube“, Ankerlinks (Funktionen, Ablauf, Standorte, FAQ, Für Studios) und Primärbutton „Vormerken“.

Leitidee der Kampagne (Annahme, bitte bestätigen): **„Dein Studio auf Abruf.“** Musik- und Aufnahmeräume, stundenweise buchbar, online bezahlt, mit Zutrittscode rund um die Uhr.

| # | Abschnitt | Zweck | Inhalt | Vorschlag Überschrift und Text |
| --- | --- | --- | --- | --- |
| 1 | **Hero** | Nutzen in 5 Sekunden klarmachen, Hauptkonversion | Wortmarke, Headline, Subline, Primär-CTA, Sekundär-CTA zur Karte, Rendering des Cubes, Mini-Vertrauenszeile | **Dein Studio. Stundenweise. Rund um die Uhr.**<br>„bcube bringt buchbare Musik- und Aufnahmeräume mitten in die Stadt. Online buchen, bezahlen und mit deinem persönlichen Zutrittscode rein, ohne Schlüsselübergabe und ohne Vertrag.“<br>CTA: **Jetzt vormerken** · Sekundär: **Standorte ansehen**<br>Zeile darunter: „Kostenlos und unverbindlich. Erfahre als Erste:r, wann dein Cube öffnet.“ |
| 2 | **Problem und Lösung** | Wiedererkennung schaffen | Drei Schmerzpunkte links, Lösung rechts | **Proberaum finden ist härter als der Song.**<br>Probleme: „Monatsmieten für Räume, die du zwei Mal im Monat brauchst.“ · „Schlüssel abholen, Termine abstimmen, Zettel an der Tür.“ · „Tonstudio ab 50 € die Stunde, nur um ein Demo aufzunehmen.“<br>Lösung: **bcube macht’s einfach.** „Du buchst genau die Stunden, die du brauchst, zahlst online und öffnest die Tür mit deinem Code. Fertig.“ |
| 3 | **Funktionen und Vorteile** | Produkt greifbar machen | 6 Kacheln mit Icon | **Alles, was du für deine Session brauchst.**<br>· **Stundenweise buchen**: „Keine Monatsmiete, kein Mindestumsatz.“<br>· **Freie Slots live**: „Verfügbarkeiten direkt im Kalender sehen.“<br>· **Sicher bezahlen**: „Per Karte oder Gutschein, Beleg inklusive.“<br>· **Zutritt per Code**: „Dein persönlicher Code öffnet das Smartlock, rund um die Uhr.“<br>· **Mitten in der Stadt**: „Öffentlich gut erreichbar, z. B. direkt am Hauptbahnhof.“<br>· **Flexibel stornieren**: „Pläne ändern sich, deine Buchung auch.“ (Stornoregeln aus AGB übernehmen) |
| 4 | **So funktioniert’s** | Hürde senken | 3 nummerierte Schritte, horizontal ab Tablet | **In drei Schritten zur Session.**<br>1. **Cube finden**: „Standort und Zeit wählen.“<br>2. **Buchen und bezahlen**: „In unter einer Minute erledigt.“<br>3. **Code eingeben und loslegen**: „Du bekommst deinen Zutrittscode, die Tür geht auf.“ |
| 5 | **Karte mit allen Studios** | Konkretheit, lokale Relevanz | MapLibre-Karte, Marker im bcube-Stil (Würfel-Pin in Orange), Popup mit Name, Adresse, Bild, Status („Eröffnet bald“), Liste darunter auf Mobile; Platzhalter-Kachel „Dein Bezirk fehlt?“ | **Hier entstehen die ersten Cubes.**<br>„Unser erster Standort öffnet in Wien. Weitere Bezirke folgen, sag uns, wo du einen Cube brauchst.“ (das Feld „Stadt/Bezirk“ im Formular dient als Nachfrage-Signal) |
| 6 | **Social Proof** | Vertrauen | Variante A (jetzt): Platzhalter mit Zahl der Vormerkungen (manuell gepflegt, keine Live-Abfrage) und 2 bis 3 Zitat-Slots für Testnutzer:innen. Variante B (später): Logos von Partnern, Bands, Unis. | **Musiker:innen aus Wien sind schon dabei.**<br>„Über [X] Vormerkungen in den ersten Wochen.“ Zitat-Platzhalter: „[Name, Band]: …“. **Nur echte Zitate verwenden**, bis dahin Abschnitt ausblenden oder nur die Zahl zeigen. |
| 7 | **Vormerk-Block (Hauptformular)** | Konversion | Formular (siehe Abschnitt 4), Incentive-Zeile | **Sichere dir deinen Platz in der ersten Reihe.**<br>„Trag dich ein und wir melden uns, sobald du buchen kannst. Vorgemerkte bekommen [Incentive, z. B. die erste Stunde gratis].“ |
| 8 | **FAQ** | Einwände ausräumen | Accordion (`<details>`), 6 bis 8 Fragen | **Häufige Fragen**<br>· Was ist ein Cube? · Für wen ist bcube? · Was kostet eine Stunde? („ab [15] € pro Stunde, finaler Preis zum Start“) · Wie komme ich rein? · Welche Ausstattung gibt es? (nur bestätigte Angaben) · Kann ich stornieren? · Wann geht’s los? · Was passiert mit meinen Daten? |
| 9 | **Für Studiobetreiber** | B2B-Leads (siehe unten) | Kurzer Pitch, eigener CTA | **Du hast einen Raum? Mach ihn zum bcube.**<br>„Wir übernehmen Buchung, Zahlung und Zutritt, du verdienst an jeder Stunde, ohne Schlüsselübergaben.“ CTA: **Studio eintragen** |
| 10 | **Zweiter Vormerk-Block** | Konversion für Scroller | Kompakte Wiederholung: Headline plus E-Mail-Feld, öffnet bzw. springt zum vollständigen Formular | **Bereit für deine erste Session?**<br>„Ein Klick, und du bist auf der Liste.“ CTA: **Jetzt vormerken** |
| 11 | **Footer** | Pflichtangaben | Logo, Kurzclaim, Links Impressum, Datenschutz, Kontakt-E-Mail, Social-Links | „bcube – Dein Studio auf Abruf.“ · Impressum · Datenschutz · Kontakt |

Zusätzliche Seiten (statisch, `noindex` wo sinnvoll): `/impressum`, `/datenschutz`, `/bestaetigt` (nach Double Opt-in), `/bestaetigung-fehlgeschlagen`, `/abgemeldet`, `404`.

### Variante für Studiobetreiber

Empfehlung: **gleiche Seite, eigener Abschnitt (#9) plus Rolle „Studiobetreiber:in“ im Formular.** Wählt jemand diese Rolle oder klickt „Studio eintragen“, erscheinen zusätzliche optionale Felder (Name des Raums, Ort, Website, Raumart: Proberaum / Aufnahmestudio / Sonstiges). Tracking unterscheidet über `audience: "musician" | "operator"`.

Begründung: Eine zweite Landingpage lohnt sich erst, wenn du gezielt Betreiber bewirbst (eigene Anzeigen). Dann wird `/studios-eintragen` als zweite Astro-Seite mit gleichen Komponenten und anderem Copy ergänzt, Aufwand gering.

**Rückfrage dazu**: Ist das Geschäftsmodell „eigene Cubes“ (wie in den Renderings) oder auch „fremde Studios auf der Plattform“? Nur im zweiten Fall ist die Betreiber-Variante sinnvoll.

---

## 3. Karte und Studiodaten

### Reicht Hardcoding?

Technisch ja: Es gibt genau ein Studio. Trotzdem ist dein Vorschlag besser, weil (a) neue Standorte ohne Codeänderung erscheinen, (b) die Daten aus einer Quelle kommen und (c) die Felder dabei kontrolliert gefiltert werden.

### Machbarkeit des Export-Skripts: gegeben

- Quelle: der öffentliche Endpunkt `GET /api/studios` (ohne Login, ohne DB-Zugriff). Alternativ lokal gegen `docker compose up`.
- **Achtung**: Der Endpunkt liefert auch interne Felder. Das Skript nutzt deshalb eine **Whitelist**:

| Exportiert | Nicht exportiert |
| --- | --- |
| `slug` (aus dem Namen erzeugt), `name`, `street`, `plz`, `city`, `country`, `lat`, `lng`, `status` (`open` / `coming_soon`), `teaser` (aus eigener Kampagnen-Datei, nicht aus der DB), `image` (Pfad zu WebP-Datei), optional `priceFromCents` | `id`, `smartlockId`, `createdAt`, `isActive` (nur als Filter), Base64-Bilder, komplette Galerie |

- Bilder: erstes Galeriebild wird dekodiert und mit `sharp` als WebP (z. B. 800 px breit) nach `public/studios/<slug>.webp` geschrieben. Keine Base64-Strings im JSON (das Seed-Studio hätte sonst mehrere MB).
- Ergänzungsdatei `data/studios.extra.json` für geplante Standorte, die noch nicht im System sind, und Kampagnentexte pro Studio. Wird beim Export zusammengeführt.
- Validierung mit Zod, Abbruch bei fehlenden Koordinaten.
- `src/data/studios.json` wird **eingecheckt**. Der Build braucht die API also nicht (die Produktions-API ist laut Terraform-README noch nicht deployed). Export läuft manuell (`npm run export:studios -- --api=https://…`) oder später als geplanter GitHub-Workflow, der einen PR erzeugt.

### Kartenverfahren

**Empfehlung: MapLibre GL JS (BSD-Lizenz, Open-Source-Fork von Mapbox GL) mit selbst gehosteten Protomaps-Kacheln (PMTiles).**

- Ein Kartenausschnitt Wien bzw. Österreich als einzelne `.pmtiles`-Datei auf dem eigenen S3/CloudFront. Keine Drittanbieter-Anfragen, kein API-Key, keine Nutzungsgrenzen, Kosten im Cent-Bereich.
- Datenschutzvorteil: Es werden keine IP-Adressen an Kachelanbieter übertragen, dafür ist also keine Einwilligung nötig.
- Dunkler Kartenstil passend zum Theme (Protomaps „dark“ mit orangen Akzenten).
- Die Karte wird erst geladen, wenn der Abschnitt in den Viewport kommt (IntersectionObserver). Vorher steht ein statisches Vorschaubild da. Das ist wichtig für Lighthouse > 90, weil MapLibre rund 250 KB gzip hat.
- Barrierefreie Alternative: Studioliste unter der Karte als normales HTML.

Alternativen:

| Option | Kosten | Hinweis |
| --- | --- | --- |
| **OpenFreeMap** (gehostete OSM-Vektorkacheln) | kostenlos, kein Key | Kein SLA, Spendenmodell, Drittanbieter bekommt IP. Gut als schneller Start oder Fallback. |
| **MapTiler / Stadia Maps** | Free-Tier, danach kostenpflichtig | Key nötig, Nutzungsbedingungen begrenzen kommerzielle Nutzung im Free-Tier. |
| **Mapbox** (wie im Bestand) | 50.000 Kartenaufrufe/Monat gratis | Key in der Seite sichtbar, also URL-Beschränkung Pflicht. Kampagnen-Peaks können Kosten auslösen. |
| `tile.openstreetmap.org` | kostenlos | **Nicht verwenden.** Die Tile Usage Policy der OSMF verbietet intensive Nutzung, verlangt einen gültigen User-Agent/Referer, gibt keine Garantie und erlaubt Sperren. Für Kampagnen ungeeignet. |

Nutzungsbedingungen in allen Fällen: **Attribution „© OpenStreetMap-Mitwirkende“ (ODbL)** sichtbar in der Karte, bei Protomaps zusätzlich „Protomaps“. Bei Mapbox, MapTiler und Stadia sind Logo bzw. Attribution vertraglich Pflicht.

---

## 4. Vormerkung und Backend

### Formular

| Feld | Typ | Pflicht | Validierung |
| --- | --- | --- | --- |
| E-Mail | `email` | ja | RFC-nah, max. 254 Zeichen, serverseitig normalisiert (lowercase, trim) |
| Name | Text | nein | max. 80 Zeichen |
| Rolle | Select | ja (Annahme) | `musiker` (Musiker:in / Solo), `band`, `producer` (Producer:in / Beatmaker), `creator` (Podcast / Content), `betreiber` (Studiobetreiber:in), `sonstiges` |
| Stadt / Bezirk | Text mit Vorschlägen (`datalist`: Wiener Bezirke, Graz, Linz, Salzburg, Innsbruck) | nein | max. 60 Zeichen |
| Betreiberfelder | nur bei Rolle `betreiber` | nein | Raumname, Ort, Website (URL) |
| Einwilligung | Checkbox | ja | Text: „Ich möchte per E-Mail informiert werden, wenn bcube startet, und stimme der Verarbeitung meiner Angaben gemäß der [Datenschutzerklärung] zu. Abmeldung jederzeit möglich.“ |
| Honeypot | verstecktes Feld `company_website` | – | muss leer sein, `tabindex="-1"`, `autocomplete="off"`, per CSS ausgeblendet |
| Zeitfalle | verstecktes Feld mit Render-Zeitstempel | – | Absenden unter 3 Sekunden gilt als Bot |
| Cloudflare Turnstile | Widget im Modus „managed“, unsichtbar wenn möglich | ja | Token wird serverseitig bei `challenges.cloudflare.com/turnstile/v0/siteverify` geprüft |
| Attribution | versteckt | – | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `landing_path`, `cta_location` |

Client: native HTML-Validierung plus kleine TS-Validierung mit deutschen Fehlermeldungen, `aria-live`-Region für Status, Button mit Ladezustand, keine Seitenneuladung.

### Backend: eine Lambda-Funktion

```
Browser ── POST /api/lead ──▶ CloudFront ──▶ Lambda Function URL (OAC-signiert)
                                              │
                                              ├─ validiert (Zod), prüft Honeypot, Zeitfalle, Turnstile
                                              ├─ schreibt Lead in DynamoDB (status = pending, token-Hash, TTL 30 Tage)
                                              ├─ sendet DOI-Mail über SES
                                              └─ antwortet 200 (auch bei Duplikaten, keine Info preisgeben)

Mail-Link ── GET /api/confirm?token=… ──▶ dieselbe Lambda
                                              ├─ prüft Token-Hash, setzt status = confirmed, entfernt TTL
                                              ├─ benachrichtigt dich per SES
                                              └─ 302 Redirect auf /bestaetigt

GET /api/unsubscribe?token=… ──▶ löscht den Lead → /abgemeldet
```

- **Eine** Funktion mit drei Routen (Node.js 22, TypeScript, mit esbuild gebündelt), wie gewünscht.
- Same-Origin über CloudFront-Pfad `/api/*`, dadurch kein CORS und keine zweite Domain.
- Benachrichtigung an dich erst bei Bestätigung (weniger Spam). Optional zusätzlich bei jedem neuen Eintrag.

**Datenbank: Amazon DynamoDB** (on-demand, `eu-central-1`, Point-in-Time-Recovery, Verschlüsselung at rest)

- Tabelle `bcube-launch-leads`, Partition Key `email`, Attribute: `status`, `role`, `name`, `city`, `operator{}`, `utm{}`, `referrer`, `consentText` + `consentVersion`, `consentAt`, `confirmedAt`, `ipHash` (gesalzen, nur für Missbrauchsschutz), `tokenHash`, `ttl`.
- Ein GSI `status-createdAt` für Exporte.
- Kosten bei Kampagnengröße praktisch 0 €. Nicht bestätigte Einträge löscht DynamoDB-TTL automatisch nach 30 Tagen.
- Warum nicht die bestehende RDS-Postgres: Die steht in einem privaten VPC und ist noch nicht deployed. Lambda in einer VPC bringt NAT-Kosten und Kaltstarts. Leads sind getrennte Daten mit getrenntem Zweck, auch datenschutzrechtlich sauberer.

**Maildienst: Amazon SES** (`eu-central-1`)

- Domain mit DKIM, SPF und DMARC verifizieren, Absender z. B. `hallo@<domain>`.
- Production Access beantragen (der Sandbox-Modus erlaubt nur verifizierte Empfänger).
- Kosten: 0,10 USD pro 1.000 Mails.
- Mailvorlagen: HTML und Text, im bcube-Look (dunkel, Orange), deutsch, Abmeldelink in jeder Mail.
- Die bestehende Gmail-SMTP-Lösung ist für Kampagnen ungeeignet (Limits, Zustellbarkeit, Absenderdomain).

**Secrets**: Turnstile-Secret und IP-Hash-Salt in SSM Parameter Store (SecureString), Lambda liest sie zur Laufzeit. Nichts davon im Code.

**Missbrauchsschutz zusätzlich**: Reserved Concurrency (z. B. 10), Body-Limit 4 KB, Rate-Limit pro IP-Hash in DynamoDB (z. B. 5 Anfragen pro 10 Minuten). AWS WAF optional (ab ca. 6 € pro Monat), erst bei Bedarf.

---

## 5. Tracking

### Werkzeug

**Empfehlung: Plausible Analytics (Cloud, Server in der EU).** Cookielos, kein Fingerprinting über Tage (täglich rotierender Hash), DPA vorhanden, Custom Events mit Properties, UTM-Auswertung und Funnels eingebaut. Kosten ab ca. 9 € pro Monat.

- Alternative ohne laufende Kosten: **Umami** selbst gehostet (z. B. Lambda plus Postgres) oder Umami Cloud (EU). Ebenfalls cookielos, aber Hosting-Aufwand.
- PostHog EU ist mächtiger (Session Replay, Feature Flags), setzt aber standardmäßig Cookies bzw. localStorage. Cookielos nur mit `persistence: "memory"`, dann gehen Wiederkehrer verloren. Für einen One-Pager überdimensioniert.

**Cookie-Banner?** In Österreich regelt § 165 Abs. 3 TKG 2021 (ePrivacy) den Zugriff auf das Endgerät, egal ob Cookie, localStorage oder sessionStorage. Plausible greift nicht auf das Endgerät zu und speichert keine personenbezogenen Daten. **Ein Einwilligungsbanner entfällt daher in der Regel**, solange wir selbst auch nichts auf dem Gerät speichern. Die Verarbeitung gehört trotzdem in die Datenschutzerklärung (berechtigtes Interesse). Keine Rechtsberatung, bitte bestätigen lassen.

### UTM und Referrer

- Beim ersten Seitenaufruf werden `utm_*`, `document.referrer` und der Landing-Pfad ausgelesen und **im Arbeitsspeicher** gehalten. Da das Formular auf derselben Seite liegt, reicht das für die allermeisten Konversionen, und es ist kein Gerätezugriff und kein Banner nötig.
- Option (deine Entscheidung): zusätzlich `sessionStorage`, damit Attribution einen Reload übersteht. Das ist rechtlich eine Grauzone (Gerätezugriff). `localStorage` über mehrere Besuche hinweg nur mit Einwilligung.
- Die Werte werden mit dem Lead an die Lambda gesendet und in DynamoDB gespeichert.

### Tracking-Plan

Hilfsfunktion: `track(eventName: string, props?: Record<string, string | number | boolean>)` sendet an Plausible (`window.plausible`), schreibt im Dev-Modus in die Konsole, ignoriert Fehler und **filtert PII** (keine E-Mail, kein Name, kein Freitext).

| Event | Auslöser | Eigenschaften |
| --- | --- | --- |
| `page_view` | Seite geladen (Plausible automatisch, inkl. UTM und Referrer) | `path`, (automatisch: `source`, `utm_*`, Gerät, Land) |
| `cta_click` | Klick auf jeden CTA-Button oder -Link | `cta_id` (`hero_primary`, `hero_map`, `nav`, `features`, `final`, `operator`), `location` (Abschnitt), `audience` |
| `form_start` | erster Fokus oder erste Eingabe im Formular (einmal pro Seitenaufruf) | `form_id` (`waitlist_main`, `waitlist_final`), `audience` |
| `form_submit` | Klick auf Absenden nach erfolgreicher Client-Validierung | `form_id`, `role`, `has_city` (bool), `has_name` (bool) |
| `form_success` | Server antwortet 200 | `form_id`, `role`, `audience` (**Konversionsziel**) |
| `form_error` | Client-Validierungsfehler oder Serverfehler | `form_id`, `error_type` (`validation`, `turnstile`, `rate_limit`, `server`, `network`), `field` (bei Validierung) |
| `map_interaction` | erstes Zoomen, Verschieben oder Laden der Karte (gedrosselt, je Typ einmal pro Aufruf) | `action` (`loaded`, `zoom`, `pan`, `list_click`) |
| `studio_marker_click` | Klick auf Marker oder Listeneintrag | `studio_slug`, `status` (`open`, `coming_soon`) |
| `scroll_depth` | Erreichen von 25, 50, 75, 100 % (je einmal) | `depth` |
| `faq_open` | Öffnen einer FAQ-Frage | `question_id` |
| `outbound_click` | Klick auf externe Links (Social, Partner) | `url_host`, `location` |
| `section_view` (zusätzlich) | Abschnitt zu 50 % sichtbar (einmal) | `section` |
| `lead_confirmed` (serverseitig, nicht in Plausible) | DOI-Link bestätigt | in DynamoDB: `confirmedAt` plus UTM des Leads |

### Konversionsraten pro Kanal auswerten

1. **UTM-Konvention** festlegen und für jeden Link konsequent nutzen, z. B.:

   | Kanal | `utm_source` | `utm_medium` | `utm_campaign` |
   | --- | --- | --- | --- |
   | Instagram organisch | `instagram` | `social` | `bcube_launch_2027` |
   | Instagram Ads | `instagram` | `paid_social` | `bcube_launch_2027` |
   | TikTok | `tiktok` | `social` / `paid_social` | `bcube_launch_2027` |
   | Newsletter | `newsletter` | `email` | `bcube_launch_2027` |
   | Flyer / Plakat (QR) | `flyer` | `offline` | `bcube_launch_2027` (`utm_content` = Standort) |
   | Kooperation | Partnername | `referral` | `bcube_launch_2027` |

2. **In Plausible**: `form_success` als Goal anlegen, Funnel `page_view → cta_click → form_start → form_submit → form_success` definieren. Unter „Sources → UTM Source / Medium / Campaign“ steht dann pro Kanal Besucher:innen, Konversionen und Konversionsrate. Custom Properties (`role`, `cta_id`) als Filter nutzen.
3. **Qualität (DOI-Rate)**: Leads aus DynamoDB als CSV exportieren (kleines Skript `npm run leads:export`) und nach `utm_source` gruppieren: `bestätigt ÷ eingetragen` pro Kanal. So siehst du, welcher Kanal echte Interessent:innen bringt und nicht nur Klicks.
4. Optional später: wöchentlicher Report per Plausible-API.

---

## 6. Technik

| Thema | Vorschlag |
| --- | --- |
| Framework | **Astro 5** (Static Output). Null JS als Standard, Inseln nur für Formular, Karte und Tracking (Vanilla TS, kein React nötig). |
| Styling | Plain CSS mit den bcube-Tokens als CSS-Variablen (`tokens.css`), komponentenbezogenes CSS in Astro. Kein Tailwind, weil der Bestand auch keins nutzt und so die Tokens 1:1 bleiben. |
| Schrift | Montserrat 400/600/700/800 als selbst gehostetes WOFF2-Subset (`@fontsource`), `font-display: swap`, Preload der wichtigsten Schnitte. Stack bleibt `"Avenir Next", Montserrat, …`. |
| Hosting | **S3 (privat) + CloudFront** mit Origin Access Control, HTTP/2 und 3, Brotli, ACM-Zertifikat (`us-east-1`, technisch für CloudFront nötig), Route 53 optional. Daten liegen in `eu-central-1`. |
| FaaS | **AWS Lambda** (Node 22, arm64) mit Function URL hinter CloudFront (`/api/*`), OAC-signiert. |
| Security-Header | CloudFront Response Headers Policy: CSP (nur eigene Domain, `challenges.cloudflare.com`, `plausible.io`), HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. |
| Caching | HTML `max-age=0, must-revalidate`, gehashte Assets 1 Jahr `immutable`, `studios.json` 5 Minuten. |
| IaC | **Terraform** (wie im Bestand, AWS-Provider `~> 5.0`), eigener State (S3-Backend plus Lock), Module: `site` (S3, CloudFront, ACM, Headers), `api` (Lambda, Function URL, IAM, Log-Gruppe mit 30 Tagen Aufbewahrung), `data` (DynamoDB), `mail` (SES-Identity, DKIM), `ci` (GitHub-OIDC-Rolle mit minimalen Rechten). |
| CI/CD | GitHub Actions: **CI** bei PR (`npm ci`, Lint, `astro check`, Typecheck, Unit-Tests Vitest, Build, Lighthouse CI mit Budget), **Deploy** bei Push auf `main` (OIDC → `terraform apply` für Lambda-Code, `aws s3 sync`, CloudFront-Invalidierung nur für HTML). Optional Preview-Deploy pro PR. |
| Lokal | `npm run dev` (Astro) plus `npm run dev:api` (Node-HTTP-Wrapper um denselben Handler, In-Memory- bzw. JSON-Store und Mail-Ausgabe in die Konsole oder an Mailpit). Astro-Dev-Proxy leitet `/api` weiter. Turnstile mit offiziellen Test-Keys. |
| Performance | Lighthouse ≥ 95 Performance mobil (Ziel), ≥ 90 Pflicht in CI. LCP < 2,0 s, CLS < 0,05, INP < 200 ms. Hero-Bild als AVIF/WebP mit `srcset`, `fetchpriority="high"`. Gesamt-JS ohne Karte < 30 KB. Karte und Turnstile lazy. |
| Barrierefreiheit | Ziel WCAG 2.2 AA: semantische Landmarks, Skip-Link, sichtbarer Fokus (oranger Ring), Kontrast geprüft (Orange `#FFA722` auf `#0B0B0B` ≈ 10:1, `#111111` auf Orange ≈ 9:1), Formular mit `<label>`, Fehlermeldungen über `aria-describedby`, FAQ mit nativen `<details>`, `prefers-reduced-motion`, Karte mit Listen-Alternative, `lang="de-AT"`. Prüfung mit axe in CI. |
| SEO | Title und Description pro Seite, Canonical, `robots.txt`, `sitemap.xml`, strukturierte Daten (`Organization`, `FAQPage`, später `LocalBusiness` pro Standort), saubere H-Hierarchie, `hreflang` nicht nötig. |
| Social Meta | Open Graph (`og:title`, `og:description`, `og:image` 1200×630, `og:locale=de_AT`), Twitter Card `summary_large_image`. |
| OG-Bild | Aus Rendering plus Logo plus Claim, statisch generiert zur Build-Zeit (Astro-Endpoint mit `satori`/`sharp`) oder einmalig als PNG gestaltet. |

### Ordnerstruktur

```
bcube-launch/
├── src/
│   ├── components/        Hero, Problem, Features, Steps, StudioMap, SocialProof,
│   │                      WaitlistForm, Faq, Operator, FinalCta, Header, Footer
│   ├── layouts/Base.astro  Meta, OG, Fonts, Plausible-Script
│   ├── lib/               track.ts, attribution.ts, form.ts, map.ts
│   ├── data/              studios.json, faq.ts, copy.ts
│   ├── styles/            tokens.css, global.css
│   └── pages/             index, impressum, datenschutz, bestaetigt, abgemeldet, 404, og.png.ts
├── public/                fonts/, studios/*.webp, tiles/*.pmtiles (oder S3), favicon, robots.txt
├── scripts/               export-studios.ts, export-leads.ts
├── functions/lead/        handler.ts, routes/, validate.ts, store.ts, mail/, templates/
├── dev/                   local-api.ts
├── infra/terraform/       Module site, api, data, mail, ci
├── .github/workflows/     ci.yml, deploy.yml
├── docs/PLAN.md
└── README.md
```

Eigenes Git-Repository im Ordner `bcube-launch`, unabhängig von `bcube/`.

---

## 7. Rechtliches Österreich – Checkliste

*Keine Rechtsberatung. Bitte vor Launch von einer fachkundigen Stelle (z. B. WKO-Datenschutz-Service, Anwalt) prüfen lassen.*

**Impressum und Offenlegung**
- [ ] Impressum nach § 5 ECG: Name/Firma, Anschrift, Kontakt (E-Mail), ggf. Firmenbuchnummer und -gericht, UID, Aufsichtsbehörde bzw. Gewerbebehörde, Kammer, anwendbare Rechtsvorschriften
- [ ] Offenlegung nach § 25 MedienG (Medieninhaber, Unternehmensgegenstand, Blattlinie bei Bedarf)
- [ ] Bei GmbH: Angaben nach § 14 UGB
- [ ] Die Platzhalter aus der bestehenden App („BCube GmbH, Musterstraße 1, FN 123456a“) durch echte Daten ersetzen

**Datenschutzerklärung (Art. 13 DSGVO)**
- [ ] Verantwortlicher, Kontakt (ggf. Datenschutzbeauftragte:r)
- [ ] Zwecke und Rechtsgrundlagen: Vormerkung/Info-Mails (Einwilligung, Art. 6 Abs. 1 lit. a), Spamschutz Turnstile, Reichweitenmessung Plausible, Server-Logs (berechtigtes Interesse, lit. f)
- [ ] Empfänger und Auftragsverarbeiter: AWS (Hosting, DB, Mail), Cloudflare (Turnstile), Plausible (Analytics), ggf. Kachelanbieter
- [ ] Drittlandübermittlung: AWS und Cloudflare sind US-Unternehmen, also EU-US Data Privacy Framework plus Standardvertragsklauseln nennen
- [ ] Speicherdauer: nicht bestätigt 30 Tage, bestätigt bis Widerruf bzw. maximal [z. B. 24 Monate nach Launch]
- [ ] Betroffenenrechte, Widerrufsrecht, Beschwerderecht bei der österreichischen Datenschutzbehörde (dsb.gv.at)

**Einwilligung und E-Mail**
- [ ] Checkbox nicht vorausgewählt, eigener Text, Link zur Datenschutzerklärung
- [ ] Double Opt-in, Nachweis speichern (Zeitpunkt, Einwilligungstext-Version, Bestätigungszeitpunkt)
- [ ] § 174 TKG 2021: Werbe-E-Mails nur mit vorheriger Einwilligung, Abmeldelink in jeder Mail, Absender erkennbar
- [ ] DOI-Mail selbst rein bestätigend, ohne Werbung
- [ ] Endgerätezugriff nach § 165 Abs. 3 TKG 2021 prüfen (siehe Tracking: kein Storage, also kein Banner)

**Auftragsverarbeitung und Dokumentation**
- [ ] AVV/DPA nach Art. 28 DSGVO: AWS (in den AWS Service Terms enthalten, im AWS Artifact abrufbar), Cloudflare, Plausible, ggf. Kachel- oder Mailanbieter
- [ ] Verzeichnis von Verarbeitungstätigkeiten (Art. 30) um „Launch-Leads“ ergänzen
- [ ] TOMs dokumentieren (Verschlüsselung, Zugriffsrechte, Löschkonzept per TTL)
- [ ] Prozess für Auskunfts- und Löschanfragen (Skript für Export und Löschung per E-Mail)

**Sonstiges**
- [ ] Bildrechte für Renderings, Fotos, Logos von Partnern; Zitate nur mit Einwilligung der Personen
- [ ] OSM-Attribution (ODbL) in der Karte
- [ ] Gewinnspiel- oder Rabattbedingungen, falls ein Incentive ausgelobt wird
- [ ] Barrierefreiheitsgesetz (BaFG, seit 28.06.2025): Anwendbarkeit prüfen (Kleinstunternehmen bei Dienstleistungen ausgenommen), WCAG AA ohnehin Ziel

---

## 8. Offene Fragen an dich

1. **Kampagnenname und Claim**: Arbeitstitel „Dein Studio auf Abruf“ ok? Gibt es einen Namen für die Kampagne bzw. einen festen UTM-Kampagnenwert?
2. **Positionierung**: Sind die Cubes wirklich Musik- und Aufnahmeräume (schallisoliert? Equipment wie PA, Drums, Interface, Mikros)? Die aktuelle Studiobeschreibung spricht von Trainingsgeräten und Yoga. Welche Ausstattung darf ich versprechen?
3. **Zielgruppe**: Schwerpunkt Hobbymusiker:innen, Bands, Producer, Studierende (mdw, Konservatorium), Podcaster? Nur Wien zum Start?
4. **Geschäftsmodell Betreiber**: Eigene Cubes oder auch Fremdstudios auf der Plattform? (entscheidet über Abschnitt 9)
5. **Incentive**: Gibt es einen Vorteil für Vorgemerkte (Gratisstunde, Gründungspreis, früher Zugang)? Preis „ab 15 €/h“ kommunizieren?
6. **Domain**: Welche Domain bzw. Subdomain (z. B. `bcube.at`, `start.bcube.at`)? Liegt DNS bei Route 53 oder woanders? Absenderadresse für Mails?
7. **Launch-Datum** der Seite und geplanter Produktstart (für Texte wie „Start im Frühjahr 2027“)?
8. **Logos und Bilder**: Gibt es das Logo als SVG? Echte Fotos der Cubes oder nur Renderings? Darf ich die Renderings aus `bcube-web/src/assets/images` verwenden?
9. **Anbieterwahl**: Plausible (ca. 9 €/Monat) ok oder lieber kostenloses Umami selbst gehostet? Cloudflare Turnstile ok? Kacheln selbst hosten (Empfehlung) oder OpenFreeMap?
10. **Impressumsdaten**: Rechtsform und echte Angaben (die App enthält nur Platzhalter).
11. **AWS**: Eigenes AWS-Konto bzw. eigener Terraform-State für die Launch-Seite oder im bestehenden bcube-Konto? GitHub-Repo-Name für `bcube-launch`?
12. **Benachrichtigung**: An welche Adresse sollen neue bestätigte Leads gehen, und bei jedem Lead oder als Tagesübersicht?
13. **Attribution**: Nur im Arbeitsspeicher (kein Banner, Empfehlung) oder zusätzlich `sessionStorage`?

### Annahmen, falls du nichts anderes sagst

- Musik-Positionierung wie oben, Start in Wien, Texte in Du-Form, keine Ausstattungsversprechen.
- Betreiber-Abschnitt auf derselben Seite, Rolle im Formular.
- Plausible, Turnstile, MapLibre mit selbst gehosteten PMTiles (für die lokale Entwicklung mit OpenFreeMap als Fallback).
- AWS `eu-central-1`, eigener Terraform-State, Platzhalter-Domain `example.com` bis zur Entscheidung.
- Attribution nur im Arbeitsspeicher, kein Cookie-Banner.
- Social-Proof-Abschnitt zunächst nur mit Platzhaltern, im Build per Flag ausblendbar.
