/**
 * Copies static extension assets (manifest, HTML, CSS, icons) into
 * extension/dist after webpack bundles the scripts.
 *
 * In a production build (EXETAZO_API_ORIGIN set) the manifest's
 * host_permissions are rewritten to the single API origin the extension
 * actually calls, so the shipped artifact asks for nothing more.
 */
const fs = require('fs');
const path = require('path');
const { resolveApiOrigin } = require('./api-origin.cjs');

const root = path.join(__dirname, '..', 'extension');
const dist = path.join(root, 'dist');
const { origin, production } = resolveApiOrigin();

const staticFiles = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'sidepanel.html',
  'sidepanel.css',
];

// Master brand source — the downscaled logo.png is what ships, not the 1.7MB original.
const SOURCE_ONLY = new Set(['logoo.png']);

fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
for (const file of staticFiles) {
  const source = path.join(root, file);
  const target = path.join(dist, file);

  if (file === 'manifest.json' && production) {
    const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
    manifest.host_permissions = [`${origin}/*`];
    fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`copied manifest.json (host_permissions narrowed to ${origin}/*)`);
    continue;
  }

  fs.copyFileSync(source, target);
  console.log(`copied ${file}`);
}
for (const icon of fs.readdirSync(path.join(root, 'assets'))) {
  if (SOURCE_ONLY.has(icon)) {
    console.log(`skipped assets/${icon} (master source, not shipped)`);
    continue;
  }
  fs.copyFileSync(path.join(root, 'assets', icon), path.join(dist, 'assets', icon));
  console.log(`copied assets/${icon}`);
}
console.log('extension/dist ready');
