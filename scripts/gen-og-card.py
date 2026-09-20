"""Generate the landing page's Open Graph card: web/og.png (1200x630).

Mirrors the first screen of the landing page — logo mark, headline with its lime
underline, subline, lime CTA pill, and the sample 42/100 report card — so a
shared link previews the page itself.

Requirements:
  pkg install python-pillow

Font: Plus Jakarta Sans (the font the landing page loads), variable weight axis.
scripts/fonts/PlusJakartaSans-var.ttf comes from the Google Fonts repository
(https://github.com/google/fonts/tree/main/ofl/plusjakartasans) and is licensed
under the SIL Open Font License 1.1.

Usage:
  python3 scripts/gen-og-card.py          # writes web/og.png
"""

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.environ.get('EXETAZO_OG_FONT', os.path.join(ROOT, 'scripts', 'fonts', 'PlusJakartaSans-var.ttf'))
LOGO = os.path.join(ROOT, 'web', 'assets', 'logo.png')
OUT = os.path.join(ROOT, 'web', 'og.png')

W, H = 1200, 630
BG = (255, 253, 248)
BLACK = (25, 25, 25)
PURPLE = (171, 159, 242)
DEEP = (60, 49, 91)
LAV = (226, 223, 254)
LIME = (241, 255, 82)
INK = (85, 81, 107)
LINE = (232, 228, 245)

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)


def font(weight, size):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f


def wrap(text, f, maxw):
    words = text.split()
    lines, cur = [], ''
    for w in words:
        trial = (cur + ' ' + w).strip()
        if d.textlength(trial, font=f) <= maxw:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def spaced(xy, text, f, fill, spacing=2.5):
    """Pill labels are letter-spaced on the page; Pillow has no tracking, so draw per glyph."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + spacing


# brand row
logo = Image.open(LOGO).convert('RGB').resize((58, 58), Image.LANCZOS)
mask = Image.new('L', (58, 58), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 57, 57], radius=16, fill=255)
img.paste(logo, (64, 60), mask)
d.text((138, 70), 'exetazo', font=font('ExtraBold', 32), fill=DEEP)

# headline, with the lime underline under "before" as on the page
h_font = font('ExtraBold', 66)
d.text((64, 168), 'Legal security', font=h_font, fill=DEEP)
d.text((64, 246), 'before you agree.', font=h_font, fill=DEEP)
d.rounded_rectangle([64, 322, 64 + d.textlength('before', font=h_font), 330], radius=4, fill=LIME)

# subline
sub_font = font('Regular', 23)
sub = ('Exetazo reads the terms of service for you, then shows the clauses that '
       'could cost you money, your data, or your right to sue.')
y = 372
for line in wrap(sub, sub_font, 560)[:3]:
    d.text((64, y), line, font=sub_font, fill=INK)
    y += 34

# lime CTA pill
cta_font = font('Bold', 21)
cta_text = 'Get the extension'
cta_w = d.textlength(cta_text, font=cta_font) + 96
d.rounded_rectangle([64, 500, 64 + cta_w, 560], radius=30, fill=LIME)
d.text((94, 519), cta_text, font=cta_font, fill=BLACK)
d.text((64 + cta_w - 46, 519), '\u2192', font=cta_font, fill=BLACK)

# sample report card
cx0, cy0, cx1, cy1 = 700, 108, 1136, 522
d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=28, fill=(255, 255, 255), outline=LINE, width=2)

score_font = font('ExtraBold', 78)
d.text((cx0 + 34, cy0 + 34), '42', font=score_font, fill=BLACK)
d.text((cx0 + 44 + d.textlength('42', font=score_font), cy0 + 84), '/ 100', font=font('Regular', 22), fill=INK)

badge_x = cx1 - 210
d.rounded_rectangle([badge_x, cy0 + 46, badge_x + 176, cy0 + 80], radius=17, fill=DEEP)
spaced((badge_x + 20, cy0 + 54), 'HIGH RISK', font('ExtraBold', 15), LAV)

counts_font = font('Medium', 18)
d.text((cx0 + 34, cy0 + 150), '4 Critical', font=counts_font, fill=INK)
d.text((cx0 + 148, cy0 + 150), '3 High', font=counts_font, fill=INK)
d.text((cx0 + 236, cy0 + 150), '3 Medium', font=counts_font, fill=INK)
d.text((cx0 + 356, cy0 + 150), '2 Low', font=counts_font, fill=INK)

d.line([cx0 + 34, cy0 + 196, cx1 - 34, cy0 + 196], fill=LINE, width=2)

d.ellipse([cx0 + 34, cy0 + 226, cx0 + 46, cy0 + 238], fill=PURPLE)
d.text((cx0 + 60, cy0 + 218), 'Unilateral Modification', font=font('Bold', 21), fill=BLACK)

sev_x = cx1 - 148
d.rounded_rectangle([sev_x, cy0 + 218, sev_x + 114, cy0 + 246], radius=14, fill=LAV)
spaced((sev_x + 16, cy0 + 225), 'CRITICAL', font('ExtraBold', 13), DEEP, 1.8)

ev_font = font('Regular', 18)
ev_lines = wrap('"We reserve the right to modify these terms at any time, without notice\u2026"',
                ev_font, 330)[:3]
ey = cy0 + 268
d.rounded_rectangle([cx0 + 34, ey - 4, cx0 + 39, ey + 26 * len(ev_lines) + 4], radius=3, fill=PURPLE)
for line in ev_lines:
    d.text((cx0 + 56, ey), line, font=ev_font, fill=INK)
    ey += 26

# footer
d.line([64, 588, W - 64, 588], fill=LINE, width=2)
d.text((64, 600), 'exetazo.xyz', font=font('SemiBold', 17), fill=DEEP)
foot = 'Deterministic scoring \u00b7 evidence on every finding \u00b7 not legal advice'
d.text((W - 64 - d.textlength(foot, font=font('Regular', 17)), 600), foot, font=font('Regular', 17), fill=INK)

img.save(OUT, optimize=True)
print(f'wrote {OUT} ({img.size[0]}x{img.size[1]}, {os.path.getsize(OUT)} bytes)')
