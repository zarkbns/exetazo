# Exetazo landing page

Static site — no build step, no dependencies. Deployed via Vercel.

## Deploy (Vercel)

1. Import the `zarkbns/exetazo` repo into Vercel.
2. Set **Root Directory** to `web` (Framework Preset: Other).
3. Deploy — `index.html` is served as-is.

## Fonts

The font stack declares `Base Sans` first. Base Sans is a licensed typeface
without a free hosted webfont, so the page loads Plus Jakarta Sans (Google
Fonts) as the visual fallback. To use the real Base Sans, drop the licensed
`.woff2` in `web/fonts/` and add an `@font-face` rule for `'Base Sans'` at the
top of `style.css` — the stack already points at it.

## Brand

| Token | Value | Use |
|---|---|---|
| Phantom Purple | `#AB9FF2` | Primary brand, interactive elements |
| Deep Purple | `#3C315B` | Dark accents, accordion panels |
| Lavender | `#E2DFFE` | Light accents, hovers |
| Cream | `#FFFDF8` | Backgrounds |
| Lime | `#F1FF52` | CTAs, highlights |
| Black | `#191919` | Dark surfaces, text |
