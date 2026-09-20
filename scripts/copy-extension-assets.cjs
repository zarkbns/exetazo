/**
 * Copies static extension assets (manifest, HTML, CSS, icons) into
 * extension/dist after webpack bundles the scripts.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'extension');
const dist = path.join(root, 'dist');

const staticFiles = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'sidepanel.html',
  'sidepanel.css',
];

fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
for (const file of staticFiles) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
  console.log(`copied ${file}`);
}
for (const icon of fs.readdirSync(path.join(root, 'assets'))) {
  fs.copyFileSync(path.join(root, 'assets', icon), path.join(dist, 'assets', icon));
  console.log(`copied assets/${icon}`);
}
console.log('extension/dist ready');
