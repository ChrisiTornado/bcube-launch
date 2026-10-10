# BCube Launch

Statischer One-Pager für den Launch von BCube am **1. Februar 2027** in Wien: Vormerkung mit Double Opt-in (gratis 4-Stunden-Session), Karte aller Cubes und Partnerstudios, cookieloses Tracking. Design und Farben stammen 1:1 aus der bcube-App (`bcube/bcube-web/src/styles.scss`).

- **Website:** Astro 7 (statisch), Vanilla TypeScript, kein UI-Framework. Initial unter 5 KB JS (gzip).
- **Karte:** MapLibre GL mit selbst gehosteten Protomaps-Kacheln (Fallback: OpenFreeMap); Daten nur aus `src/data/studios.json`.
- **Backend:** eine Lambda-Funktion (Node 22) hinter API Gateway (HTTP API), DynamoDB, SES – alles in `eu-central-1`.
- **Tracking:** Plausible (cookielos), Hilfsfunktion `track(eventName, props)`.
- **Infrastruktur:** Terraform (S3 + CloudFront + ACM, Lambda, API Gateway, DynamoDB, SES, SSM, GitHub-OIDC).

Der ursprüngliche Plan steht in [`docs/PLAN.md`](docs/PLAN.md).

---

## Inhalt

1. [Schnellstart lokal](#schnellstart-lokal)
2. [Projektstruktur](#projektstruktur)
3. [Umgebungsvariablen](#umgebungsvariablen)
4. [Studiodaten exportieren](#studiodaten-exportieren)
5. [Karte und Kacheln](#karte-und-kacheln)
6. [Vormerkung, Double Opt-in, Spamschutz](#vormerkung-double-opt-in-spamschutz)
7. [Tracking und Auswertung](#tracking-und-auswertung)
8. [Deployment auf AWS](#deployment-auf-aws)
9. [Qualität: Tests, Linting, Lighthouse](#qualität-tests-linting-lighthouse)
10. [Abweichungen vom Plan und Annahmen](#abweichungen-vom-plan-und-annahmen)

---

## Schnellstart lokal

Voraussetzung: Node.js ≥ 22.

```bash
npm install
cp .env.example .env          # NOTIFY_EMAIL eintragen, Rest passt für lokal

# Terminal 1 – lokale Lead-Funktion (Port 8787, gleicher Code wie in AWS)
npm run dev:api

# Terminal 2 – Website (http://localhost:4321, leitet /api an die Funktion weiter)
npm run dev
```

Lokal gilt:

- **Leads** landen in `dev/leads.local.json`, **Mails** als HTML in `dev/outbox/` und als Text in der Konsole (inklusive Bestätigungslink zum Anklicken).
- **Turnstile** nutzt die offiziellen Test-Keys von Cloudflare (bestehen immer). Offline: `TURNSTILE_BYPASS=true` in `.env` (nur bei `STAGE=local` wirksam).
- **Tracking-Events** erscheinen in der Browser-Konsole als `[track] …`.

## Projektstruktur

```
src/
  components/      Abschnitte des One-Pagers (Hero, Features, StudioMap, WaitlistForm, Faq, …)
  layouts/         Base (Meta, OG, JSON-LD), Legal
  lib/             track.ts, attribution.ts, form.ts, map.ts, page.ts, roles.ts, consent.ts
  data/            studios.json (generiert), studios.extra.json (gepflegt), faq.ts
  pages/           index, impressum, datenschutz, teilnahmebedingungen, bestaetigt, abgemeldet, …
  styles/          tokens.css (bcube-Design-Tokens), global.css
functions/lead/    Lambda: app.ts (Routen), schema.ts, store.ts, mailer.ts, turnstile.ts, templates/
dev/local-api.ts   lokaler HTTP-Server für die Funktion
scripts/           export-studios.ts, export-leads.ts, generate-og.ts, build-function.mjs, fetch-map-data.sh
infra/terraform/   Infrastruktur
tests/             Vitest (Validierung, Tracking-Filter, Studio-Export, kompletter Lead-Ablauf)
```

## Umgebungsvariablen

### Website (Build-Zeit, öffentlich)

Alle `PUBLIC_*`-Werte landen im ausgelieferten HTML/JS. **Keine Geheimnisse.**

| Variable | Beispiel | Zweck |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://bcube.at` | Canonical, Open Graph, Sitemap |
| `PUBLIC_PLAUSIBLE_DOMAIN` | `bcube.at` | Plausible-Site. Leer = kein Tracking-Script |
| `PUBLIC_PLAUSIBLE_SRC` | `https://plausible.io/js/script.js` | Script-URL (bei Plausible-Proxy anpassen) |
| `PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAAA…` | Cloudflare Turnstile Site Key (öffentlich) |
| `PUBLIC_MAP_PMTILES_URL` | `https://bcube.at/tiles/austria.pmtiles` | Selbst gehostete Kacheln. Leer = OpenFreeMap |
| `PUBLIC_SHOW_SOCIAL_PROOF` | `false` | Zitat-Slots anzeigen (erst mit echten Zitaten) |
| `PUBLIC_LEAD_COUNT` | `250` | Manuell gepflegte Zahl der Vormerkungen, leer = ausblenden |

### Funktion (Laufzeit)

In AWS setzt Terraform diese Werte, Geheimnisse liegen im SSM Parameter Store.

| Variable | Lokal (.env) | AWS | Zweck |
| --- | --- | --- | --- |
| `STAGE` | `local` | `prod` | `local` erlaubt Turnstile-Bypass |
| `SITE_URL` | `http://localhost:4321` | `https://bcube.at` | Links in Mails, Redirects |
| `TABLE_NAME` | – | Terraform | DynamoDB-Tabelle |
| `MAIL_FROM` / `MAIL_REPLY_TO` | `BCube <hallo@bcube.at>` | Terraform | Absender |
| `NOTIFY_EMAIL` | deine Adresse | `terraform.tfvars` | Benachrichtigung bei bestätigter Vormerkung |
| `TURNSTILE_SECRET` | Test-Secret | – | lokal direkt |
| `TURNSTILE_SECRET_PARAM` | – | `/bcube-launch/prod/turnstile-secret` | SSM-Parametername |
| `IP_HASH_SALT` / `IP_HASH_SALT_PARAM` | beliebig | SSM | HMAC-Salt für Lead-IDs und IP-Hashes (**nie rotieren**) |
| `CONSENT_VERSION` | `2026-10-v1` | Terraform | Version des Einwilligungstexts (bei Textänderung erhöhen) |
| `SES_CONFIGURATION_SET` | – | Terraform | SES-Reputation und Suppression-Liste |

`.env` und `infra/terraform/terraform.tfvars` sind in `.gitignore`. Committet werden nur die `*.example`-Dateien.

## Studiodaten exportieren

Die Seite liest **nur** `src/data/studios.json`. Das Skript holt die öffentlichen Daten aus dem `studio-service` (`GET /api/studios`) und übernimmt per Whitelist nur: Slug, Name, Art (Cube/Partner), Status, Adresse, Koordinaten (auf ca. 11 m gerundet), Kampagnentext und Titelbild. **Nicht** exportiert werden die interne ID, `smartlockId`, `createdAt`, die DB-Beschreibung und Base64-Galerien. Inaktive Studios überspringt das Skript; bei unbekannten Feldern bricht es ab.

```bash
# gegen die lokale bcube-Umgebung (docker compose up im bcube-Repo)
npm run export:studios -- --api=http://localhost:8082
# gegen Produktion
npm run export:studios -- --api=https://app.bcube.at
# aus einer gespeicherten API-Antwort
npm run export:studios -- --input=./studios-response.json
```

Kampagnentexte, Anzeigenamen, Reihenfolge, Status („Ab 1. Februar 2027“) und Standorte, die noch nicht im System sind (z. B. Partnerstudios), pflegst du in `src/data/studios.extra.json`. Titelbilder schreibt das Skript als WebP nach `public/studios/<slug>.webp`. Nach dem Export `studios.json` und die Bilder committen.

> Die aktuell eingecheckte `studios.json` wurde aus einer API-Antwort im Format des studio-service erzeugt, gebaut aus den Seed-Daten (`StudioInitializer`). Vor dem Launch einmal gegen die echte API exportieren.

## Karte und Kacheln

- Ohne `PUBLIC_MAP_PMTILES_URL` nutzt die Karte **OpenFreeMap** (kostenlos, ohne Key, ohne SLA). Dabei geht die IP der Besucher:innen an OpenFreeMap; das steht als Platzhalter in der Datenschutzerklärung.
- **Empfohlen für Produktion:** Kacheln selbst hosten. Dann gibt es keine Drittanbieter-Anfragen und keine Nutzungsgrenzen.
  ```bash
  ./scripts/fetch-map-data.sh                # braucht die pmtiles-CLI (brew install pmtiles)
  aws s3 cp public/tiles/austria.pmtiles s3://<site_bucket>/tiles/austria.pmtiles --cache-control "public,max-age=604800"
  # public/map-assets (Schriften/Sprites) committen, PUBLIC_MAP_PMTILES_URL setzen
  ```
- **Nutzungsbedingungen:** Die Attribution „© OpenStreetMap-Mitwirkende“ (ODbL) muss sichtbar bleiben (die Karte setzt sie automatisch). `tile.openstreetmap.org` ist für Kampagnen tabu, weil die Tile Usage Policy der OSMF intensive Nutzung verbietet.
- Die Karte lädt erst, wenn der Abschnitt in die Nähe des Viewports kommt (eigener Chunk, ca. 270 KB gzip). Darunter steht eine barrierefreie Liste aller Standorte.

## Vormerkung, Double Opt-in, Spamschutz

**Ablauf:** Formular (Kund:innen `waitlist_main` oder Partner `partner_main`) → `POST /api/lead` → Validierung (Zod) → Honeypot und Zeitfalle → Rate-Limit (5 pro IP in 10 Minuten) → Turnstile → Lead als `pending` in DynamoDB speichern (TTL 30 Tage) → DOI-Mail → Klick auf `GET /api/confirm` → `confirmed`, TTL entfernt → Benachrichtigung an `NOTIFY_EMAIL` → Weiterleitung auf `/bestaetigt/`.

- **Abmeldung:** Link in jeder Mail und RFC-8058-One-Click-Header (`List-Unsubscribe-Post`). Der Lead wird dabei **gelöscht**.
- **Datenschutz:** Die IP wird nur als HMAC gespeichert; die Lead-ID ist ein HMAC der E-Mail (kein Klartext in Links). Der Einwilligungstext (`src/lib/consent.ts`) wird mit Version und Zeitstempel gespeichert.
- **Keine Preisgabe:** Ob eine Adresse schon eingetragen ist, verrät die Antwort nicht. Eine erneute DOI-Mail geht frühestens nach 5 Minuten raus.
- **Studiobetreiber:innen** haben ein **eigenes Formular** (`partner_main`, Abschnitt „Für Studiobetreiber:innen“, eingeklappt bis zum Klick auf „Studio eintragen“) mit festem `role=betreiber`, Pflichtfeld Studioname, eigenem Einwilligungstext (`consent.ts`), eigener DOI-Mail ohne Gutschein und eigener Bestätigungsseite `/partner-bestaetigt/`. Das Kund:innen-Formular bietet die Rolle nicht an und verweist darunter auf das Partner-Formular.
- **Mailvorlagen:** `functions/lead/templates/` (dunkles bcube-Layout, HTML und Text).
- **Lead-Export** (CSV und DOI-Rate pro Kanal): `npm run export:leads -- --table=$(terraform -chdir=infra/terraform output -raw leads_table_name)`

## Tracking und Auswertung

`src/lib/track.ts` filtert personenbezogene Daten heraus (Schlüssel wie `email`/`name`, E-Mail-artige Werte) und ist ohne Plausible-Script ein No-op.

| Event | Auslöser | Eigenschaften |
| --- | --- | --- |
| `page_view` | Seitenaufruf (Plausible automatisch) | Pfad, Quelle, UTM (automatisch) |
| `cta_click` | Klick auf ein Element mit `data-cta-id` | `cta_id`, `location`, `audience` |
| `form_start` | erste Interaktion mit einem Formular | `form_id`, `audience` |
| `form_submit` | Absenden nach gültiger Client-Validierung | `form_id`, `role`, `audience`, `has_city`, `has_name` |
| `form_success` | Server antwortet 200 (**Conversion-Ziel**) | `form_id`, `role`, `audience` |
| `form_error` | Validierung, Turnstile, Rate-Limit, Server, Netzwerk | `form_id`, `error_type`, `field`/`status` |
| `map_interaction` | Karte geladen, erster Zoom/Pan, Klick in der Liste | `action`, `tiles`, `studio_slug` |
| `studio_marker_click` | Klick auf Marker oder Listeneintrag | `studio_slug`, `status`, `kind`, `source` |
| `scroll_depth` | 25 / 50 / 75 / 100 % | `depth` |
| `faq_open` | FAQ-Frage geöffnet | `question_id` |
| `outbound_click` | externer Link oder `mailto:` | `url_host`, `location` |
| `section_view` | Abschnitt zu 50 % sichtbar | `section` |

**UTM-Konvention:** `utm_campaign=bcube_launch_2027`, `utm_source` = Plattform (`instagram`, `tiktok`, `newsletter`, `flyer`, Partnername), `utm_medium` = `social` | `paid_social` | `email` | `offline` | `referral`, `utm_content` = Motiv bzw. Flyer-Standort.

UTM-Parameter und Referrer werden beim ersten Aufruf **nur im Arbeitsspeicher** erfasst und mit dem Lead gespeichert. Es gibt keinen Cookie und keinen Storage, deshalb ist kein Banner nötig. Ankerlinks auf der Startseite sind reine `#…`-Links, damit die Seite nicht neu lädt und die Attribution erhalten bleibt.

**Auswertung pro Kanal:**

1. In Plausible ein Goal `form_success` anlegen und den Funnel `cta_click → form_start → form_submit → form_success` definieren. Unter *Sources → UTM Source/Medium/Campaign* stehen dann Conversion-Raten pro Kanal.
2. Für die Qualität pro Kanal (bestätigt ÷ eingetragen) `npm run export:leads` ausführen; das Skript gibt die DOI-Rate pro `utm_source` als Tabelle aus.

## Deployment auf AWS

### Einmalig

1. **Konten anlegen:** AWS (Region `eu-central-1`), Cloudflare (nur Turnstile, kostenlos), Plausible (Site `bcube.at`).
2. **Terraform-State:** `backend "s3"` in `infra/terraform/versions.tf` aktivieren (eigener Key `launch/…`).
3. **Variablen:** `cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars` und Domain, `route53_zone_id` (falls DNS bei Route 53), `notify_email`, `github_repository` eintragen. Gibt es im Konto schon einen GitHub-OIDC-Provider (bcube-Stack), dessen ARN als `github_oidc_provider_arn` setzen.
4. **Erst bauen, dann anwenden:**
   ```bash
   npm ci && npm run build:function
   cd infra/terraform && terraform init && terraform apply
   ```
   Ohne Route 53 hält `apply` beim Zertifikat an. Dann die Records aus `terraform output acm_validation_records` beim DNS-Anbieter anlegen; `apply` läuft weiter, sobald ACM sie sieht. Danach die Domain per CNAME/ALIAS auf `cloudfront_domain_name` zeigen lassen und die `ses_dkim_records` anlegen.
5. **Geheimnisse setzen** (bis dahin startet die Funktion absichtlich nicht):
   ```bash
   aws ssm put-parameter --overwrite --type SecureString --name /bcube-launch/prod/turnstile-secret --value '<Turnstile Secret>'
   aws ssm put-parameter --overwrite --type SecureString --name /bcube-launch/prod/ip-hash-salt --value "$(openssl rand -base64 32)"
   ```
6. **SES Production Access** in der SES-Konsole beantragen (Sandbox = nur verifizierte Empfänger). Bis dahin zum Testen die eigene Adresse verifizieren.
7. **Turnstile:** Widget für `bcube.at` anlegen (Modus „Managed“). Der Site Key kommt in die GitHub-Variable, das Secret in SSM (Schritt 5).
8. **Postfach `hallo@bcube.at` → Gmail:** SES versendet nur. Zum Empfangen eine Weiterleitung beim Domain-Anbieter einrichten (oder z. B. Cloudflare Email Routing / ImprovMX) mit Ziel deiner Gmail-Adresse. Wichtig: MX-Records nicht mit SES verwechseln. SPF-Eintrag des Weiterleitungsdienstes und `include:amazonses.com` kombinieren.
9. **GitHub:** Repo anlegen, Environment `prod` erstellen und die Variablen aus dem Kopf von `.github/workflows/deploy.yml` eintragen (Werte aus `terraform output`).

### Laufend

- Push auf `main` → **CI** (Lint, Typecheck, Tests, Build, Lighthouse ≥ 90, Terraform validate) und **Deploy** (Lambda-Code, S3-Sync mit Cache-Headern, CloudFront-Invalidierung).
- Infrastrukturänderungen: `terraform plan` / `terraform apply` manuell.

### Kosten (Schätzung, Kampagnengröße)

CloudFront/S3/Lambda/API Gateway/DynamoDB liegen bei typischem Kampagnen-Traffic im Free Tier bzw. bei wenigen Cent. SES kostet 0,10 USD pro 1.000 Mails, Plausible ab ca. 9 €/Monat, Turnstile ist kostenlos, Route 53 kostet 0,50 USD pro Zone und Monat.

## Qualität: Tests, Linting, Lighthouse

```bash
npm run ci            # Lint + astro check + Vitest + Build + Lambda-Bundle
npx lhci autorun      # Lighthouse mobil gegen dist/ (Budget ≥ 90 je Kategorie)
```

Stand der lokalen Prüfung (10.10.2026): 24 Tests grün, ESLint und `astro check` ohne Befund, `terraform validate` und `terraform fmt` ok. Lighthouse mobil für die Startseite: Performance 100, Barrierefreiheit 100, Best Practices 100, SEO 100 (Lauf vor dem letzten Fix: 98 / 100 / 96 / 100).

## Abweichungen vom Plan und Annahmen

- **API Gateway HTTP API statt Lambda Function URL:** Es bringt Throttling pro Stage mit (Schutz vor Missbrauch und Kosten). Außerdem hätte eine Function URL hinter CloudFront mit OAC bei POST einen vom Browser berechneten Payload-Hash verlangt. Kosten: ca. 1 USD pro Mio. Anfragen.
- **Bestätigungslink per GET:** Manche Mail-Sicherheitsscanner rufen Links vorab auf und könnten so eine Bestätigung auslösen. Falls das in der Praxis auffällt: `/api/confirm` auf eine Zwischenseite mit Button (POST) umstellen.
- **Positionierung und Zahlen** stammen aus deinem Pitch (20 €/h, 10 €/h Student-Rate, Equipment, Nachhaltigkeit). Prozentangaben ohne Quelle (z. B. „55 % kämpfen mit Planungsproblemen“) habe ich bewusst weggelassen; mit Quellenangabe lassen sie sich im Problem-Abschnitt ergänzen.
- **Holzbau Willinger** (Königsbrunn, NÖ) steht im Abschnitt „Bereits an Bord“ als Holzbau-Partner mit Link zur Website (holzbau-willinger.at). Die Rolle „Holzbau-Partner“ ist meine Annahme; bitte Formulierung und Nennung mit dem Unternehmen abstimmen. St. Pölten ist komplett entfernt, der Start ist ausschließlich in Wien.
- **Gratis-Session:** Die Bedingungen in `/teilnahmebedingungen/` sind ein Entwurf (Frist 31.01.2027, Einlösung bis 30.04.2027, nur eigene Cubes) und müssen final festgelegt werden.
- **Domain** `bcube.at` (wie im Impressum der App), Absender `hallo@bcube.at`. Die Startseite liegt auf der Apex-Domain; soll die App später dort laufen, die Launch-Seite z. B. auf `start.bcube.at` legen.
- **Rechtstexte** (Impressum, Datenschutz, Teilnahmebedingungen) sind Vorlagen mit markierten Platzhaltern, keine Rechtsberatung. Die Checkliste steht in `docs/PLAN.md`, Abschnitt 7.
