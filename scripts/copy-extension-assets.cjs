/**
 * Copies static extension assets (manifest, HTML, CSS, icons) into the built
 * extension folders after webpack bundles the scripts.
 *
 * One build emits both browser targets from the same source:
 *   extension/dist          — Chrome (sidePanel + service worker)
 *   extension/dist-firefox  — Firefox (sidebar_action + event page)
 *
 * In a production build (EXETAZO_API_ORIGIN set) both manifests' host_permissions
 * are rewritten to the single API origin the extension actually calls.
 */
const fs = require('fs');
const path = require('path');
const { resolveApiOrigin } = require('./api-origin.cjs');
const { toFirefoxManifest, withApiOrigin } = require('./firefox-manifest.cjs');

const root = path.join(__dirname, '..', 'extension');
const dist = path.join(root, 'dist');
const distFirefox = path.join(root, 'dist-firefox');
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

// Webpack writes the bundles into dist; both browser targets ship the same JS
// (the panel seam is feature-detected at runtime), so they are mirrored over.
const BUNDLES = ['background.js', 'contentScript.js', 'popup.js', 'sidepanel.js'];

fs.rmSync(distFirefox, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
fs.mkdirSync(path.join(distFirefox, 'assets'), { recursive: true });

for (const bundle of BUNDLES) {
  fs.copyFileSync(path.join(dist, bundle), path.join(distFirefox, bundle));
  console.log(`copied ${bundle}`);
}

for (const file of staticFiles) {
  const source = path.join(root, file);

  if (file === 'manifest.json') {
    const manifest = withApiOrigin(JSON.parse(fs.readFileSync(source, 'utf8')), origin, production);

    if (production) {
      fs.writeFileSync(path.join(dist, file), `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`copied manifest.json (host_permissions narrowed to ${origin}/*)`);
    } else {
      fs.copyFileSync(source, path.join(dist, file));
      console.log('copied manifest.json');
    }

    const firefoxManifest = toFirefoxManifest(manifest);
    fs.writeFileSync(
      path.join(distFirefox, file),
      `${JSON.stringify(firefoxManifest, null, 2)}\n`,
    );
    console.log(
      production
        ? `dist-firefox manifest.json (host_permissions narrowed to ${origin}/*)`
        : 'dist-firefox manifest.json (sidebar_action + event page)',
    );
    continue;
  }

  fs.copyFileSync(source, path.join(dist, file));
  fs.copyFileSync(source, path.join(distFirefox, file));
  console.log(`copied ${file}`);
}
for (const icon of fs.readdirSync(path.join(root, 'assets'))) {
  if (SOURCE_ONLY.has(icon)) {
    console.log(`skipped assets/${icon} (master source, not shipped)`);
    continue;
  }
  fs.copyFileSync(path.join(root, 'assets', icon), path.join(dist, 'assets', icon));
  fs.copyFileSync(path.join(root, 'assets', icon), path.join(distFirefox, 'assets', icon));
  console.log(`copied assets/${icon}`);
}
console.log('extension/dist + extension/dist-firefox ready');
