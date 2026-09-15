# AGENTS.md

This file is the operational contract for coding agents working on **Exetazo**.

Exetazo is a Chrome extension that scans legal agreements for risky clauses before users agree to them. It uses AI to understand semantics, but final scoring is deterministic and rule-based — no black boxes.

Primary reference: `README.md` (product vision, UX flow, philosophy). See `server/rules/` for the 15 risk categories.

---

## 📦 Project Profile

* **Project:** Exetazo — Legal security scanner for Chrome
* **Track:** LexHack 2026 (Access to Justice, Digital Rights, AI Safety/Ethics, Legal Automation)
* **Stack:** TypeScript (frontend + backend), Chrome Manifest V3, Node.js, LLM integration (semantic analysis only)
* **Build tooling:** npm for dependencies, Webpack for bundling, Jest for testing
* **Core deliverable:** Chrome extension that scans real webpages and produces deterministic risk reports

---

## Core Identity

You are operating inside a **security-auditing system for legal text**. Evidence over magic. Reproducibility over convenience. Real analysis over mock data.

Every change must preserve:

* **Deterministic Scoring** — Final risk score is reproducible from structured findings and rules, never from AI confidence
* **Evidence-Based Findings** — Every finding must map back to actual text in the source document
* **Rule Clarity** — All 15 risk categories have explicit definitions and severity logic
* **No False Authority** — Tool flags *potential* risks, not legal conclusions; never claims to provide legal advice
* **Real Webpage Analysis** — MVP demo scans actual legal pages, not fixtures or mocked data
* **AI in Service of Rules** — AI assists semantic detection and explanation, but does not determine severity or score
* **Privacy by Default** — Minimal data retention, secrets server-side only
* **Extraction Robustness** — Handles noise (navigation, ads, banners), dynamic content, and malformed HTML

---

## 🛠️ Verification & Build Commands

Before declaring any task complete, run and pass this sequence:

1. **Dependencies installed:** `npm install`
2. **Extension builds:** `npm run build:extension`
3. **Backend builds:** `npm run build:server`
4. **All tests pass:** `npm run test` (100% pass rate)
5. **No secrets in source:** `grep -r "OPENAI\|API_KEY\|SECRET" extension/ src/ --exclude-dir=node_modules` (should return nothing)
6. **Scoring logic self-check:** After any change to rules or scoring, manually verify with 2–3 real documents. Score should be reproducible: same document → same score every time.

Run this sequence yourself before calling anything done. Don't wait for a human approval.

---

## 🔒 Non-Negotiable Rules

**Always**

* Read `README.md` and the risk categories in `server/rules/` before modifying the analyzer or scoring logic.
* Keep extraction, detection, rules, and scoring modular — each layer should be testable in isolation.
* Test extraction against real legal pages with noise (navigation, sidebars, repeated headers).
* Test rules against both documents where the clause exists and documents where it doesn't (avoid false positives).
* Every risk category needs a clear definition, severity rationale, and test cases.
* Emit findings with evidence (source clause text) and location (section, line range if possible).
* Validate AI output before using it — malformed responses should not crash the system.
* Score deterministically: fixed penalties per severity level, no floating-point weirdness, reproducible results.
* Minimize data sent to LLM (semantic analysis only, not full documents).
* Keep secrets (API keys, model endpoints) server-side, never in extension or committed `.env` files.
* Write complete file structures — no truncated sections or TODOs.

**Never**

* Accept AI-generated scores as the final risk rating. Rules determine severity.
* Allow findings without evidence (source text or location).
* Deploy extraction changes without testing against 3+ real legal pages.
* Claim Exetazo provides legal advice or is a substitute for a lawyer.
* Store full legal documents by default.
* Expose credentials in extension source, content scripts, popup code, or `.env` files.
* Skip error handling — gracefully degrade if AI is slow, unreachable, or returns malformed output.
* Double-count the same underlying issue across multiple findings (e.g., don't flag "broad arbitration" and "arbitration contradiction" separately if they're the same clause).
* Allow the scan to run indefinitely — set timeouts for AI and backend calls (5 second max).
* Leave `// TODO` markers or placeholder implementations.

**Ask first** (not really — these are yours to decide)

* Adding new risk categories beyond the initial 15 — design the category definition, severity logic, test cases, and ship it
* Adjusting penalty weights (Critical -20, High -10, Medium -5, Low -2) — tune if you notice scoring imbalance, document your changes
* Choosing between side panel vs. popup for report display — either works, pick and move
* Deciding which LLM to use for semantic analysis — pick one, make it swappable in config
* Implementing contradiction detection — if you have time, build it; if not, ship without it

These are engineering decisions. Decide and move. Flag non-obvious calls in commits. Don't block on approval.

---

## Determinism Boundary

The deterministic scoring and evidence-backed findings are Exetazo's thesis — users can trust the report because they understand *why* each finding exists. You don't need sign-off to ship changes, but the bar for visibility is higher:

* Make the call, implement it, and **state it plainly in the commit message** — which rule changed, what the new severity logic is, why. One sentence is enough.
* If you're tweaking penalty weights or adding a new category, include a brief example: "Auto-renewal now penalizes -15 (up from -10) because it combines with modification clause to create compounding risk. Example: [Company name] ToS, line 42."
* The one thing still off-limits: **making score non-deterministic or tied to AI confidence.** Implementing *within* the deterministic model is your call; changing what "deterministic" means isn't.

---

## Risk Categories & Definitions

All 15 categories live in `server/rules/`. Each needs:

1. **Definition** — What does this clause look like? What language triggers it?
2. **Severity default** — Critical? High? Medium? Low?
3. **Rationale** — Why is it risky? (e.g., "Unilateral modification removes user consent and predictability")
4. **Test cases** — Examples of clauses that trigger it + false-positive checks
5. **Localization** — Does it vary by jurisdiction? (e.g., arbitration clauses differ US vs. EU)

Example:

```
UNILATERAL MODIFICATION
Definition: Clause allowing company to change terms without user consent or notice
Severity: CRITICAL
Rationale: Destroys user agency; terms can become unfavorable retroactively
Language patterns: "reserves the right to modify", "amend at any time", "without notice"
Test: ✓ Amazon ToS p. 5 (triggers), ✗ GitHub ToS p. 3 (requires 30-day notice, does not trigger)
```

Implement all 15 categories. If adding more, follow this template.

---

## Working Style

* Question your own assumptions about extraction, detection, and scoring, but resolve them yourself against `README.md` and existing rules rather than stopping to ask. If extraction is dropping legal text or missing clauses, go debug it — don't leave it open.
* Research first, implement second — but implement. Don't leave a design question half-answered when you could just ship a reasonable answer.
* After implementing a change, mentally simulate: real ToS with the risky clause (should flag it), real ToS without it (should not flag it), edge cases (contradictory clauses, ambiguous language, truncated text). Does the rule still hold?
* Work is complete when all tests pass (100%), the extension scans a real webpage without crashing, findings are deterministic, and (for anything touching scoring or a new risk category) the commit message explains what changed and why.

---

## Priority Order When Editing

1. Preserve deterministic scoring (reproducible, rule-based, no AI magic)
2. Keep evidence accuracy high (minimize false positives, verify false negatives)
3. Keep extraction robust (handle noise, dynamic content, malformed HTML)
4. Keep the extension fast (<5 seconds per scan)
5. Everything else (UI polish, landing page, performance optimization)

---

## Architecture Decisions

**Text Extraction:** Content script runs in page context (can access DOM), sends sanitized text to backend. Backend re-cleans, removes noise (nav, banners, footer). Preserves enough metadata to map findings back to source.

**Clause Detection:** Semantic AI + pattern matching. AI understands meaning (synonyms, paraphrases); patterns catch obvious keywords. Both must align — if AI says it's there but patterns don't match, flag as low confidence.

**Rules Engine:** Synchronous, deterministic. No async calls, no LLM in the critical path. Rules file is the source of truth for severity and definitions.

**Scoring:** Additive penalties (start at 100, subtract per finding). Severity levels are fixed multipliers (Critical -20, High -10, Medium -5, Low -2). No floating point, no probabilities.

**LLM Integration:** Separate from scoring. Used for semantic detection, explanation generation, contradiction finding. Model is injected via config — easily swappable.

**Error Handling:** Extraction fails → report "Could not extract legal text" (honest). AI call fails → skip AI features, use rules only (graceful degradation). Backend timeout → report "Analysis took too long" (clear).

---

## Developer Resources

**Hackathon (Required):**
- LexHack 2026 Devpost: https://lexhack-2026.devpost.com/ (submit here)
- Submission Deadline: Friday, June 12, 2026 at 10:00 PM EST
- Demo Day: Saturday, June 13, 2026 (presentations begin 9:00 AM)
- Prizes: .xyz domain (all), Adaption Labs premium, referral awards ($500/$300/$200)
- Discord: Join via Devpost for team formation and mentor support

**Chrome Extension Development:**
- Official Dev Guide: https://developer.chrome.com/docs/extensions/
- Manifest V3 Specification: https://developer.chrome.com/docs/extensions/mv3/
- Content Scripts Guide: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Side Panels API: https://developer.chrome.com/docs/extensions/reference/sidePanel/
- Service Workers (background): https://developer.chrome.com/docs/extensions/mv3/service_workers/
- Best Practices: https://developer.chrome.com/docs/extensions/mv3/best-practices/

**Security & Privacy:**
- Content Security Policy: https://developer.chrome.com/docs/extensions/mv3/content_security_policy/
- Privacy Best Practices: https://support.google.com/chrome?p=ext_privacy_best_practices
- Secrets Management: Never commit `.env` files; use backend-only config

**AI & LLM Integration:**
- OpenAI API Reference: https://platform.openai.com/docs/api-reference
- Structured Outputs (for consistent finding JSON): https://platform.openai.com/docs/guides/structured-outputs
- Prompt Engineering Guide: https://platform.openai.com/docs/guides/prompt-engineering
- Safety & Compliance: https://openai.com/safety/

**Legal & Compliance:**
- EFF Digital Rights Resources: https://www.eff.org/deeplinks
- FTC Consumer Rights: https://www.consumer.ftc.gov/
- GDPR Compliance: https://gdpr-info.eu/

**Testing & Quality:**
- Jest Testing Framework: https://jestjs.io/
- Chrome Extension Testing: https://developer.chrome.com/docs/extensions/mv3/testing/
- Real Legal Documents: Use actual ToS from Notion, Stripe, GitHub, AWS, Figma for test suite (helps catch real-world patterns)

**Deployment:**
- Chrome Web Store Publishing: https://developer.chrome.com/docs/webstore/publish/
- Vercel (Backend hosting): https://vercel.com/docs
- GitHub Actions (CI/CD): https://docs.github.com/en/actions
- Domain Registration: .xyz (sponsor benefit from LexHack)

**Community:**
- Chrome Extensions Discord: https://discord.gg/ChromeExtensions (Google-run, very active)
- Stack Overflow: Tag with `google-chrome-extension` and `manifest-v3`
- LexHack Discord: Invite link in your Devpost submission

---

## Running Exetazo on Termux (mobile setup)

For anyone picking this repo up from Android/Termux:

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs git -y
npm install
npm run build:extension
npm run build:server
npm run test
```

**Using AgentRouter for LLM calls:**

Add to `~/.bashrc`:

```bash
export OPENAI_API_KEY=your-agentrouter-key
export OPENAI_BASE_URL=https://agentrouter.org/v1
export OPENAI_MODEL=gpt-5.6-sol
```

Then reload and launch your agent:

```bash
source ~/.bashrc
opencode
```

Git push over SSH works the same as any other Termux setup — no extra config beyond your SSH key.

---

## Shipping Peak Quality (Like Condition, Handshake, Sherwood)

This isn't a prototype. This is the real product.

**Real Demo (Non-Negotiable):**
- Scan actual legal pages (Notion, Stripe, GitHub, Amazon ToS), not fixtures
- Show deterministic scoring (same page, same score every time)
- Click findings and watch them highlight real clauses
- No fake data, no mock findings

**Ship Completeness:**
- All 15 risk categories implemented with test cases
- Extension loads and works without developer mode hacks
- Backend runs without manual setup
- Landing page is polished and live
- README explains everything clearly
- AGENTS.md gives agents everything they need

**Demo Day Talking Points:**
1. **The Problem:** People don't understand what they're agreeing to
2. **Our Solution:** Security-audit model, not chatbot. Deterministic scoring. Real evidence.
3. **The Live Demo:** Open real ToS → Scan → "42/100 HIGH RISK" → Click finding → Highlight clause → Explain why it matters
4. **Why It Works:** Every user is protected *before* they click accept. No AI magic, just rules + evidence.

**Judge's Scorecard (LexHack Focus):**
- **Real User:** Who is this for? (Lawyer? Consumer? Student? Have a persona.)
- **Solves Real Problem:** Does it actually help them understand legal risk?
- **Working Product:** Does it work on real legal pages?
- **Deterministic:** Can judges reproduce the same score twice?
- **Launch-Ready:** Could this actually ship as a Chrome extension?

**Exetazo wins by:**
- Being honest about limitations ("This is a tool, not legal advice")
- Shipping evidence-based findings (not AI opinions)
- Working end-to-end (scan → report → highlight → explanation)
- Feeling like a professional tool, not a prototype

---

## Deployment Checklist

Before pushing to main:

- [ ] `npm run test` passes 100%
- [ ] `npm run build:extension` creates valid Manifest V3 extension
- [ ] `npm run build:server` creates working backend
- [ ] Extension loads in Chrome without errors
- [ ] Scans 3+ real legal pages in <5 seconds each
- [ ] Findings are deterministic (scan same page twice → identical score)
- [ ] All findings have evidence (source text + location)
- [ ] Score is calculated without AI (rules only)
- [ ] No API keys in extension source or `.env` files
- [ ] Landing page is live and explains the product
- [ ] Legal disclaimer is clear and visible
- [ ] README walks through setup + testing
- [ ] AGENTS.md gives agents full authority
- [ ] No `// TODO` markers in code
- [ ] Demo script is rehearsed (real page, real analysis, real highlight)

---

## Quick Reference: Execution Path

**Week 1 (Days 1–2: Kickoff + Planning)**
- Set up repo structure (extension/, server/, shared/, web/)
- Implement Manifest V3 + content extraction (get text off real page)
- Design finding schema (ID, category, severity, evidence, explanation)
- Define 15 risk categories in `server/rules/` with test cases
- Plan API contract: POST `/analyze` → structured findings + score

**Week 1 (Days 3–5: Core MVP)**
- Backend extraction + clause detection (no AI yet)
- Implement first 5 rules (unilateral modification, arbitration, class waiver, auto-renewal, cancellation)
- Deterministic scoring (start 100, subtract per finding)
- Extension UI: report display + finding detail view
- Test against 3+ real legal pages

**Week 1 (Days 6–7: Completion)**
- Implement remaining 10 rules
- AI semantic analysis + explanations (if stable)
- Source clause highlighting
- Landing page (hero, problem, demo, disclaimer, install CTA)
- Final testing, bug fixes, deployment checklist

**Demo Day (Presentation Flow)**
1. Show the problem (real ToS, no one reads it)
2. Open Exetazo extension
3. Scan in real-time (live analysis, 2–3 seconds)
4. Show report: "42/100 HIGH RISK" with breakdown
5. Click a critical finding
6. Watch clause highlight in the original page
7. Read explanation: "Why this matters, what to watch for"
8. Show landing page on `.xyz` domain
9. "This ships Monday." (or Friday, before LexHack deadline)

**Ship Confidence Checklist**
- Extension: ✓ Loads, scans real pages, produces reports
- Backend: ✓ Runs, analyzes text, calculates scores
- Rules: ✓ All 15 categories defined, tested, reproducible
- Evidence: ✓ Every finding points to actual text
- Determinism: ✓ Same page scanned twice = same result
- Privacy: ✓ No credentials in source, no data stored
- Demo: ✓ Works on real legal pages, no mocks
- Code: ✓ No TODOs, tests pass 100%, no secrets committed
- Landing: ✓ Explains product, has disclaimer, links to Chrome Web Store
- Deployment: ✓ Ready to submit to LexHack + publish extension

---

**Exetazo is a security tool built for real users. Shipping peak quality.**
