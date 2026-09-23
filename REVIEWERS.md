# Building Exetazo from source (Mozilla Add-ons review)

This archive contains the complete source code for the Exetazo Firefox
extension. The submitted package (`exetazo_legal_security_before_you_agree-0.1.0.zip`)
is built from this source with the steps below. Nothing is minified, and no
step requires credentials or private keys.

## Requirements

- Node.js 18+ and npm
- Network access to the npm registry
- No environment variables, accounts, or secrets

## Build

```bash
npm ci
EXETAZO_API_ORIGIN=https://api.exetazo.xyz npm run build:extension
npx --yes web-ext@10.7.0 build --source-dir extension/dist-firefox --artifacts-dir web-ext-artifacts
```

The last step produces `web-ext-artifacts/exetazo_legal_security_before_you_agree-0.1.0.zip` —
the package submitted for review.

## Verifying the build matches the submitted package

Unzip the submitted package and the rebuilt package into separate directories
and compare file contents:

```bash
diff -r submitted/ rebuilt/
```

All files should be identical. `EXETAZO_API_ORIGIN` is build-time configuration,
not a secret: it bakes the analysis-API origin into the bundles and becomes the
only `host_permissions` entry in the built manifest (`https://api.exetazo.xyz/*`).

## What the build does

- `npm ci` installs the exact toolchain pinned in `package-lock.json`
  (webpack + ts-loader compile the TypeScript; web-ext packages the result).
- `npm run build:extension` emits two targets from one source:
  `extension/dist` (Chrome: side panel + service worker) and
  `extension/dist-firefox` (Firefox: `sidebar_action`, event-page background,
  gecko settings). The Firefox package is the latter.
- The Firefox manifest is generated from the shared source manifest by
  `scripts/firefox-manifest.cjs`; its behavior is pinned by
  `tests/extension-manifest.test.ts`.

## Running the test suite (optional)

```bash
npm test
```

## Notes

- The analysis API is rules-only: no AI provider receives page content, and
  nothing is stored server-side. The privacy policy at
  <https://www.exetazo.xyz/privacy> (source: `web/privacy.html`) documents the
  full data flow, and the source matches it.
- `https://api.exetazo.xyz` serves the serverless endpoint deployed from
  `api/analyze.ts` in this same repository — the same code as the local API in
  `server/api/server.ts`, sharing one request contract.
