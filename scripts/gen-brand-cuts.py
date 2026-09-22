"""Regenerate the brand cuts from the master logo (extension/assets/logoo.png).

The master is the 1254x1254 source of truth; everything else is derived:
  web/assets/logo.png        64px  (landing page nav mark)
  web/favicon.png            32px  (landing page favicon)
  extension/assets/logo.png  96px  (popup + side panel brand rows)

Pure stdlib — no Pillow needed. Box-filter downsampling, deterministic output:
re-running it on unchanged inputs reproduces the committed files byte for byte.

Usage:
  python3 scripts/gen-brand-cuts.py
"""

import struct
import zlib
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, 'extension', 'assets', 'logoo.png')
OUTS = [
    (os.path.join(ROOT, 'web', 'assets', 'logo.png'), 64),
    (os.path.join(ROOT, 'web', 'favicon.png'), 32),
    (os.path.join(ROOT, 'extension', 'assets', 'logo.png'), 96),
]


def decode_rgb(png):
    assert png[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    pos, idat = 8, b''
    header = None
    while pos < len(png):
        ln = struct.unpack('>I', png[pos:pos + 4])[0]
        typ = png[pos + 4:pos + 8]
        if typ == b'IHDR':
            header = struct.unpack('>IIBBBBB', png[pos + 8:pos + 21])
        elif typ == b'IDAT':
            idat += png[pos + 8:pos + 8 + ln]
        pos += 12 + ln
    width, height, depth, color, _, _, interlace = header
    assert depth == 8 and color == 2 and interlace == 0, 'expected 8-bit RGB, non-interlaced'
    raw = zlib.decompress(idat)
    bpp, stride = 3, width * 3

    prev = bytearray(stride)
    rows = []
    p = 0
    for _ in range(height):
        filt = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if filt == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 255
        elif filt == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif filt == 3:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif filt == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        rows.append(line)
        prev = line
    return width, height, rows


def downsample(rows, width, height, size):
    xb = [min(size - 1, (x * size) // width) for x in range(width)]
    yb = [min(size - 1, (y * size) // height) for y in range(height)]
    acc = [[0] * (size * size) for _ in range(3)]
    counts = [0] * (size * size)
    for y in range(height):
        row = rows[y]
        base = yb[y] * size
        for x in range(width):
            o = base + xb[x]
            i = x * 3
            acc[0][o] += row[i]
            acc[1][o] += row[i + 1]
            acc[2][o] += row[i + 2]
            counts[o] += 1
    out = bytearray(size * size * 3)
    for o in range(size * size):
        count = counts[o] or 1
        out[o * 3] = acc[0][o] // count
        out[o * 3 + 1] = acc[1][o] // count
        out[o * 3 + 2] = acc[2][o] // count
    return out


def encode(size, pixels):
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    body = b''.join(b'\x00' + bytes(pixels[y * size * 3:(y + 1) * size * 3]) for y in range(size))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) +
            chunk(b'IDAT', zlib.compress(body, 9)) + chunk(b'IEND', b''))


master = open(MASTER, 'rb').read()
width, height, rows = decode_rgb(master)
for path, size in OUTS:
    data = encode(size, downsample(rows, width, height, size))
    with open(path, 'wb') as fh:
        fh.write(data)
    print(f'{os.path.relpath(path, ROOT)}  {size}x{size}  {len(data)} bytes')
