// Bündelt die Lead-Funktion für AWS Lambda (Node.js 22, arm64) nach dist-function/index.mjs.
// Das AWS SDK v3 ist in der Lambda-Laufzeit enthalten und wird daher nicht mitgebündelt.
import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

await rm('dist-function', { recursive: true, force: true });
const result = await build({
  entryPoints: ['functions/lead/handler.ts'],
  outfile: 'dist-function/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  minify: true,
  sourcemap: 'linked',
  external: ['@aws-sdk/*'],
  metafile: true,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  legalComments: 'none',
});
const bytes = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0);
console.log(`✓ dist-function/index.mjs gebaut (${(bytes / 1024).toFixed(1)} KB inkl. Sourcemap)`);
