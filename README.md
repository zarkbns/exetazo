# Exetazo 🔍

> **Legal security before you agree.**

Exetazo is a Chrome extension (Manifest V3) plus an analysis API that reads terms
of service, privacy policies, and subscription agreements, flags risky clauses,
and scores the document with fixed rules — the way a smart-contract audit
reports vulnerabilities.

- **Deterministic score** — fixed integer penalties computed by the rules engine; a model never sets the score
- **Evidence on every finding** — the exact clause text, located in the cleaned document and highlightable on the page
- **Not legal advice** — a risk-detection tool for human review

Landing page: [www.exetazo.xyz](https://www.exetazo.xyz) (static, deployed on Vercel).

---

## How a scan works

1. **Extract** — the content script pulls block-level text from the *rendered* page and removes navigation, header/footer, cookie/consent, promotional, and layout noise. Page text is treated as untrusted data: it is never executed and never rendered as markup.
2. **Clean** — the API normalizes the text into clause-sized paragraphs with section headings and character offsets. Pages with fewer than 60 words of legal text get an explicit `not-legal-text` answer — no findings are fabricated.
3. **Detect (rules)** — the rules engine matches 15 category patterns plus cross-checks for self-contradicting documents, emitting findings whose severity, title, explanation, and recommendation come from the rule catalog. Every finding carries the verbatim evidence it matched.
4. **Detect (semantic, optional)** — if configured, a model proposes paragraph-level candidates for categories the rules missed. Candidates are validated against the cleaned document (evidence is always real text, never model output) and merged as **advisory** findings.
5. **Score** — `100 − 20·critical − 10·high − 5·medium − 2·low`, clamped to 0–100, duplicate finding IDs counted once. Risk bands: 80–100 low, 60–79 moderate, 30–59 high, 0–29 critical, lifted by severity floors (a critical finding never reads below HIGH RISK).
6. **Report** — the side panel renders the score, counts, and findings; clicking a finding scrolls to and highlights the exact clause (section-aware anchoring, with a raw text-node fallback).

**Determinism boundary:** only rules findings affect the score. Semantic findings
are labelled advisory in the report — a model can add context but cannot change
a document's score, so identical pages always produce identical scores.

---

## What it checks — 15 categories

1. **Unilateral Modification** — the company can change the terms anytime
2. **Mandatory Arbitration** — you waive the right to sue in court
3. **Class-Action Waiver** — you can't join a class lawsuit
4. **Automatic Renewal** — subscriptions renew without a clear reminder
5. **Difficult Cancellation** — cancelling needs calls, letters, or mazes
6. **Broad Liability Limitation** — damages capped or disclaimed broadly
7. **Broad Indemnification** — you cover the company's legal costs
8. **Broad Data Sharing** — data shared with vaguely defined third parties
9. **Data Sale Permissions** — selling your data is explicitly permitted
10. **Data Retention Ambiguity** — "kept as long as necessary", undefined
11. **Account Termination Rights** — vague grounds, no appeal
12. **Forced Venue / Jurisdiction** — disputes fought where they choose
13. **Hidden Fees / Pricing Changes** — surprise charges, mid-term changes
14. **Broad IP / Content Ownership** — expansive rights over your content
15. **Contradictory Clauses** — the document takes back its own promises

Each category has an explicit definition, a rule catalog entry with negation
guards, a severity, jurisdiction notes, and tests — including real-world
false-positive controls (see `tests/rules.test.ts`).

---

## AI's role, precisely

**Does:** propose paragraph-level candidates for categories the rules missed,
when `OPENAI_API_KEY` is configured. Without it the pipeline is fully
rules-based.

**Does not:** set severity (rule catalog), set the score (fixed arithmetic),
write evidence (always the document's own text), or answer questions (this is a
scanner, not a chatbot).

---

## Privacy — exact behavior

- **The backend is stateless.** No database, no cache, no analytics. The only
  lines it ever logs are its own startup message (port, semantic mode).
- Document text exists only in memory for the duration of a request. On Vercel,
  the platform records invocation metadata (time, status, duration) — not
  request bodies.
- **The extension stores exactly one thing:** the most recent report —
  structured findings, not page text — in `chrome.storage.session`, which
  clears when the browser closes.
- No accounts, no sign-up, no tracking, no telemetry.
- **Secrets stay server-side.** Model credentials are server environment
  variables only; the extension ships no credentials (see `.env.example`).

---

## Repository layout

```
api/analyze.ts               Vercel serverless endpoint (same contract as the local API)
extension/
  manifest.json              MV3 manifest (dev origins; production builds narrow host_permissions)
  src/background.ts          service worker: inject content script, call API, session storage
  src/content.ts             page-text extraction + clause highlighting
  src/sidepanel.ts           report UI   |  src/popup.ts  launcher
  src/messages.ts            extension contracts + build-time API base
  webpack.config.cjs         bundles src/*.ts → dist/
  assets/                    toolbar/store icons, logo (logoo.png is the master source)
server/
  api/main.ts, server.ts     local HTTP API (framework-free node:http, CORS, error contract)
  analyzer/clean.ts          noise removal, sections, offsets, word count
  analyzer/analyze.ts        pipeline: clean → rules → contradictions → optional AI → score
  rules/catalog.ts           the 15 categories: patterns, negations, severity, guidance
  rules/engine.ts            matching + finding construction
  rules/contradictions.ts    cross-checks for self-contradicting documents
  scoring/score.ts           fixed-penalty scoring + risk bands
  llm/                       optional OpenAI-compatible semantic layer
shared/types.ts              finding / report / error contracts
scripts/                     build + asset tooling (see "Asset regeneration")
web/                         landing page (static) — Vercel Root Directory = web
tests/                       jest suites (see "Testing")
```

---

## Development

Prerequisites: Node 18+. (Python 3 with Pillow is needed only for the OG-card script.)

```bash
npm install                 # or: npm ci — clean, lockfile-exact install
npm test                    # full test suite
npm run build:server        # tsc → dist/server
npm run start:server        # API on :8787 (rules-only unless OPENAI_API_KEY is set)
npm run build:extension     # webpack + asset copy → extension/dist
```

Server environment variables (all optional — see `.env.example`): `OPENAI_API_KEY`,
`OPENAI_BASE_URL`, `OPENAI_MODEL` enable the semantic layer; `PORT` changes the
port (default 8787).

### Load the extension in Chrome (unpacked)

1. `npm run build:extension`
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/dist`
3. Start the API: `npm run start:server` (the dev build calls `http://127.0.0.1:8787`)
4. Open any terms page, click the Exetazo icon, press **Scan**

### Firefox

One build emits both browser targets from one source — `extension/dist` (Chrome)
and `extension/dist-firefox`. The Firefox variant swaps the service worker for an
event page, uses Firefox's native `sidebar_action` instead of the Chrome side
panel (the **same** `sidepanel.html` renders — no duplicate UI), and carries the
gecko settings needed for addons.mozilla.org (`exetazo@exetazo.xyz`, data-collection
disclosure: website content sent to the API for transient analysis).

1. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `extension/dist-firefox/manifest.json`
2. Start the API (`npm run start:server`) and open a terms page
3. Click the Exetazo icon → **Scan** — the sidebar opens with the same report; clicking a finding highlights the clause on the page

`npx web-ext lint --source-dir extension/dist-firefox` passes with zero errors,
warnings, and notices. For a production build, set `EXETAZO_API_ORIGIN` as below —
both targets get the narrowed `host_permissions`.

---

## Production configuration

Two Vercel projects deploy from this one repo:

| Project | Root Directory | Framework | Notes |
|---|---|---|---|
| Landing page | `web` | Other | No build step, no env vars. Live at exetazo.xyz (www canonical). |
| Analysis API | repo root | Other | Serves `POST /api/analyze` + `GET /api/health` from `api/analyze.ts`. Rules-only, so it needs **no environment variables and no secrets**. |

Point the extension at the deployed API at build time:

```bash
EXETAZO_API_ORIGIN=https://your-api-host.vercel.app npm run build:extension
```

The value becomes the bundle's API base and the **only** entry in the built
manifest's `host_permissions`. Unset means local development (`http://127.0.0.1:8787`,
dev origins kept). Non-HTTPS origins other than loopback fail the build. This is
configuration, not a secret — the extension ships no credentials.

---

## Reproducible demo

```bash
env -u OPENAI_API_KEY -u OPENAI_BASE_URL -u OPENAI_MODEL npm run start:server
```

The score is rules-only either way — semantic findings are advisory and cannot
move it (enforced in `server/scoring/score.ts`, proven in `tests/analyzer.test.ts`).
Verify the whole path against five live policies, each scanned twice:

```bash
npm run validate:pages
```

Demo flow: open a real terms page → Scan → read the score and severity counts →
click a finding → the exact clause highlights on the page (lime, settling to
lavender) → check EVIDENCE, EXPLANATION, RECOMMENDATION.

---

## Testing

```bash
npm test                            # or: npx jest --runInBand (low-memory devices)
```

- `extraction.test.ts` — cleaning against verbatim real-policy excerpts: noise removed, clause text preserved verbatim, offsets consistent
- `rules.test.ts` — all 15 categories with true positives, real-world false-positive controls, and negation cases
- `contradictions.test.ts` — contradiction pairs, reconciliation guards, end-to-end scoring
- `scoring.test.ts` — penalties, bands, floors, duplicate prevention, reproducibility, advisory exclusion
- `analyzer.test.ts` — the pipeline on real documents, plus the determinism boundary (any AI candidate set, and a model returning fabricated evidence, cannot change the score)
- `api.test.ts` / `vercel-api.test.ts` — the HTTP contracts: validation, error codes, CORS, byte-identical repeat scans
- `llm.test.ts` — malformed/model-failure handling and graceful degradation to rules-only
- `extension-dom.test.ts` — extraction and highlighting in jsdom against a verbatim live ToS page (noise removal, repeated-clause section anchoring, table cells, hostile text)
- `extension-render.test.ts` — the side panel renders untrusted report content as text, labels advisory findings, and shows the clear no-analysis state

---

## Asset regeneration

```bash
python3 scripts/gen-brand-cuts.py   # logo cuts from the master (byte-identical output)
node scripts/gen-icons.cjs          # toolbar/store icons
python3 scripts/gen-og-card.py      # social preview card (needs Pillow)
```

---

## Legal disclaimer

Exetazo flags *potential* risks for human review. It does not provide legal
advice, does not create an attorney-client relationship, does not decide whether
a clause is legal or illegal, and does not replace a lawyer. Jurisdiction,
context, and specific wording all matter — consult a lawyer for important
agreements.

---

## Priorities

1. **Accuracy** — fewer, correct findings beat a flood of false positives
2. **Evidence** — every finding points to actual text
3. **Determinism** — score, severity, and findings are reproducible
4. **Speed** — a scan completes well inside five seconds
5. **Clarity** — users understand what was found and why it matters

---

## Resources

- [Chrome Extensions documentation](https://developer.chrome.com/docs/extensions/) · [Manifest V3](https://developer.chrome.com/docs/extensions/develop/concepts/mv3-overview) · [Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome Web Store publishing](https://developer.chrome.com/docs/webstore/publish/)
- [Vercel documentation](https://vercel.com/docs)

MIT licensed.
