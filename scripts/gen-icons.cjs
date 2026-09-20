/**
 * Generates the Exetazo action icons (magnifier on a dark rounded square)
 * as valid PNGs with zero dependencies. Output: extension/assets/icon{16,32,48,128}.png
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const s = size;
  const margin = 0.08 * s;
  const radius = 0.22 * s;
  const cx = 0.44 * s;
  const cy = 0.44 * s;
  const ringOuter = 0.26 * s;
  const ringInner = 0.16 * s;
  const handleWidth = 0.07 * s;

  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      const idx = (y * s + x) * 4;

      // rounded-square background with a subtle vertical gradient
      const x0 = margin;
      const x1 = s - 1 - margin;
      const y0 = margin;
      const y1 = s - 1 - margin;
      if (x < x0 || x > x1 || y < y0 || y > y1) {
        pixels[idx + 3] = 0;
        continue;
      }
      const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius));
      const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius));
      if (dx * dx + dy * dy > radius * radius) {
        pixels[idx + 3] = 0;
        continue;
      }
      const t = y / s;
      pixels[idx] = Math.round(11 + 20 * t); // R
      pixels[idx + 1] = Math.round(18 + 24 * t); // G
      pixels[idx + 2] = Math.round(32 + 38 * t); // B
      pixels[idx + 3] = 255;

      // magnifier ring
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= ringOuter && dist >= ringInner) {
        pixels[idx] = 245;
        pixels[idx + 1] = 247;
        pixels[idx + 2] = 250;
      }
      // glass tint inside the ring
      if (dist < ringInner) {
        pixels[idx] = Math.round(pixels[idx] * 0.55 + 96 * 0.45);
        pixels[idx + 1] = Math.round(pixels[idx + 1] * 0.55 + 165 * 0.45);
        pixels[idx + 2] = Math.round(pixels[idx + 2] * 0.55 + 250 * 0.45);
      }
      // handle: diagonal segment from ring edge outward
      const hx0 = cx + ringOuter * 0.7071;
      const hy0 = cy + ringOuter * 0.7071;
      const hx1 = cx + (ringOuter + 0.16 * s) * 0.7071;
      const hy1 = cy + (ringOuter + 0.16 * s) * 0.7071;
      const vx = hx1 - hx0;
      const vy = hy1 - hy0;
      const len2 = vx * vx + vy * vy;
      const t2 = clamp01(((x - hx0) * vx + (y - hy0) * vy) / len2);
      const px = hx0 + t2 * vx;
      const py = hy0 + t2 * vy;
      const distToHandle = Math.hypot(x - px, y - py);
      if (distToHandle <= handleWidth / 2) {
        pixels[idx] = 245;
        pixels[idx + 1] = 247;
        pixels[idx + 2] = 250;
      }
    }
  }
  return png(s, s, pixels);
}

const assetsDir = path.join(__dirname, '..', 'extension', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(assetsDir, `icon${size}.png`), drawIcon(size));
  console.log(`icon${size}.png written`);
}
