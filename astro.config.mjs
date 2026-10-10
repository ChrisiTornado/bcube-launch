// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://bcube.at';
const LOCAL_API = process.env.LOCAL_API_URL || 'http://localhost:8787';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    // Kein Inline-CSS/JS: hält die Content-Security-Policy ohne 'unsafe-inline' aus.
    inlineStylesheets: 'never',
  },
  integrations: [
    sitemap({
      filter: (page) => !/\/(bestaetigt|partner-bestaetigt|abgemeldet|bestaetigung-fehlgeschlagen)\/?$/.test(page),
    }),
  ],
  vite: {
    build: {
      assetsInlineLimit: 0,
      // MapLibre (~1 MB, 270 KB gzip) liegt in einem eigenen Chunk, der erst beim Scrollen zur Karte lädt.
      chunkSizeWarningLimit: 1200,
    },
    // Verhindert im Dev-Server den "optimized dependencies changed"-Reload, der den lazy Import der Karte abbricht.
    optimizeDeps: {
      include: ['maplibre-gl', 'pmtiles', '@protomaps/basemaps'],
    },
    server: {
      // Lokales Backend (npm run dev:api) unter demselben Pfad wie in Produktion (CloudFront /api/*).
      proxy: {
        '/api': LOCAL_API,
      },
    },
  },
});
