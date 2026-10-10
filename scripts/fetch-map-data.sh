#!/usr/bin/env bash
# Lädt selbst gehostete Kartendaten (Protomaps) für Österreich herunter:
#   1. public/tiles/austria.pmtiles   – Vektorkacheln (Ausschnitt aus dem täglichen Protomaps-Build, ODbL)
#   2. public/map-assets/             – Schriften (Glyphs) und Sprites für den Kartenstil
#
# Voraussetzungen: pmtiles-CLI (https://github.com/protomaps/go-pmtiles/releases, z. B. `brew install pmtiles`), git
# Danach: Kacheln nach S3 hochladen (werden nicht ins Git/Deploy-Sync übernommen):
#   aws s3 cp public/tiles/austria.pmtiles s3://<site_bucket>/tiles/austria.pmtiles --cache-control "public,max-age=604800"
# und PUBLIC_MAP_PMTILES_URL=https://bcube.at/tiles/austria.pmtiles setzen.
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD_DATE="${1:-$(date -u -v-2d +%Y%m%d 2>/dev/null || date -u -d '2 days ago' +%Y%m%d)}"
BBOX="9.4,46.3,17.2,49.1"   # Österreich
MAXZOOM="${MAXZOOM:-15}"

mkdir -p public/tiles
echo "→ Kacheln ${BUILD_DATE} für ${BBOX} (maxzoom ${MAXZOOM}) …"
pmtiles extract "https://build.protomaps.com/${BUILD_DATE}.pmtiles" public/tiles/austria.pmtiles --bbox="${BBOX}" --maxzoom="${MAXZOOM}"

echo "→ Glyphs und Sprites …"
tmp="$(mktemp -d)"
git clone --depth 1 --filter=blob:none --sparse https://github.com/protomaps/basemaps-assets "$tmp" >/dev/null 2>&1
git -C "$tmp" sparse-checkout set "fonts/Noto Sans Regular" "fonts/Noto Sans Medium" "fonts/Noto Sans Italic" sprites/v4 >/dev/null
rm -rf public/map-assets && mkdir -p public/map-assets/sprites
cp -R "$tmp/fonts" public/map-assets/
cp "$tmp"/sprites/v4/dark* public/map-assets/sprites/ 2>/dev/null || true
mkdir -p public/map-assets/sprites/v4 && mv public/map-assets/sprites/dark* public/map-assets/sprites/v4/
rm -rf "$tmp"

du -sh public/tiles/austria.pmtiles public/map-assets
echo "✓ Fertig. public/map-assets committen, austria.pmtiles nach S3 hochladen (siehe Kopf dieser Datei)."
