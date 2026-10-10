/**
 * Erzeugt public/og.png (1200×630) für Open Graph / Social Cards aus dem Hero-Bild, Logo und Claim.
 * Einmalig ausführen und das Ergebnis committen:  npm run og
 */
import sharp from 'sharp';

const W = 1200;
const H = 630;

const overlay = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#0b0b0b" stop-opacity="0.96"/>
      <stop offset="0.55" stop-color="#0b0b0b" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#0b0b0b" stop-opacity="0.05"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.1" cy="0.15" r="0.5">
      <stop offset="0" stop-color="#ffa722" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ffa722" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <style>
    .t { font-family: 'Avenir Next', Montserrat, 'Helvetica Neue', Arial, sans-serif; font-weight: 800; }
    .s { font-family: 'Avenir Next', Montserrat, 'Helvetica Neue', Arial, sans-serif; font-weight: 600; }
  </style>
  <text x="168" y="118" class="t" font-size="46" fill="#ffffff">cube</text>
  <text x="72" y="255" class="t" font-size="76" fill="#ffffff" letter-spacing="1">DEIN STUDIO.</text>
  <text x="72" y="340" class="t" font-size="76" fill="#ffa722" letter-spacing="1">RUND UM DIE UHR.</text>
  <text x="74" y="405" class="s" font-size="30" fill="#ffffff" fill-opacity="0.8">Profi-Recording ab 20 €/h · mitten in Wien</text>
  <rect x="72" y="460" width="560" height="74" rx="18" fill="#ffa722"/>
  <text x="352" y="508" class="t" font-size="28" fill="#111111" text-anchor="middle">Gratis 4-h-Session sichern</text>
  <text x="72" y="590" class="s" font-size="22" fill="#ffffff" fill-opacity="0.55">Start am 1. Februar 2027 · bcube.at</text>
</svg>`);

const logo = await sharp('src/assets/images/logo.jpg')
  .resize(72, 72)
  .composite([{ input: Buffer.from('<svg width="72" height="72"><rect width="72" height="72" rx="16" fill="#fff"/></svg>'), blend: 'dest-in' }])
  .png()
  .toBuffer();

await sharp('src/assets/images/cube-city.jpg')
  .resize(W, H, { fit: 'cover', position: 'right' })
  .composite([
    { input: overlay, top: 0, left: 0 },
    { input: logo, top: 64, left: 80 },
  ])
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile('public/og.png');

console.log('✓ public/og.png erzeugt (1200×630)');
