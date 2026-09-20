# Exetazo 🔍

> **Legal security before you agree.**

Exetazo is a Chrome extension that scans legal agreements for risky clauses, unfair terms, hidden obligations, and contradictions — before you sign.

Inspired by smart-contract security: **CertiK audits code for vulnerabilities. Exetazo audits legal text for the same.**

---

## The Problem

Most people accept Terms of Service, Privacy Policies, and subscription agreements without reading them. Those agreements often contain clauses that:

- Allow unilateral changes without notice
- Remove your right to sue (mandatory arbitration)
- Prevent class-action lawsuits
- Auto-renew with difficult cancellation
- Sell or share your data broadly
- Limit liability with vague language
- Contain contradictions that favor the company

Exetazo finds these *before* you click accept.

---

## How It Works

1. **Open any legal webpage** (Terms of Service, Privacy Policy, subscription agreement, etc.)
2. **Launch Exetazo** from the Chrome toolbar
3. **Scan** — extension analyzes the page
4. **Review findings** — security-style report with severity levels
5. **Click a finding** — highlights the actual problematic clause
6. **Understand why** — explanation of the risk and recommendation

```
Real Legal Webpage
      ↓
Text Extraction (noise removal)
      ↓
Clause Detection (semantic AI)
      ↓
Risk Rules Engine (deterministic scoring)
      ↓
Security Report (42/100 HIGH RISK)
      ↓
Click Finding → Highlights Source Clause
```

**Report Example:**

```
EXETAZO SECURITY REPORT

42 / 100
HIGH RISK

4 Critical | 3 High | 3 Medium | 2 Low

CRITICAL
• Unilateral Modification
• Mandatory Arbitration
• Broad Data Sharing
• Auto-Renewal
```

---

## Core Philosophy

**Exetazo is a security tool, not a chatbot.**

- Evidence over claims — every finding links to actual text
- Deterministic scoring over AI magic — rules are reproducible
- Real webpage analysis over mock data — no fake reports
- Explainability over black boxes — you understand why it flagged something
- Reliability over features — fewer false positives, fewer false negatives

---

## Risk Categories

Exetazo scans for 15 common problematic clause types:

1. **Unilateral Modification** — Company can change terms anytime
2. **Mandatory Arbitration** — You waive the right to sue in court
3. **Class-Action Waiver** — You can't join a class lawsuit
4. **Automatic Renewal** — Subscription auto-renews without explicit reminder
5. **Difficult Cancellation** — Hard to cancel; require calling, mailing, etc.
6. **Broad Liability Limitation** — Company limits damages in unreasonable ways
7. **Broad Indemnification** — You agree to cover company's legal costs
8. **Broad Data Sharing** — Data shared with many third parties
9. **Data Sale/Sharing Permissions** — Explicit permission to sell user data
10. **Data Retention Ambiguity** — Unclear how long data is kept
11. **Account Termination Rights** — Company can terminate your account for vague reasons
12. **Mandatory Venue/Jurisdiction** — Forces disputes to specific location
13. **Hidden Fees or Pricing Changes** — Unclear pricing or surprise charges
14. **Broad IP/Content Ownership** — Company claims ownership of your content
15. **Contradictory Clauses** — Document contradicts itself

---

## Architecture

```
EXETAZO CHROME EXTENSION
        │
┌───────┴────────┐
│                │
Extension     Backend API
(UI + Extract) (Analysis + Secrets)
│
├── Manifest V3
├── Content Script (text extraction)
├── Side Panel (report display)
└── Popup (quick launcher)

Backend
├── Text → Clause Detection (AI semantic)
├── Rules Engine (deterministic scoring)
├── Risk Catalog (15 categories)
└── Score Calculation (no AI guessing)
```

---

## What It's NOT

**Not a legal chatbot.** Exetazo doesn't answer questions or provide legal advice.

**Not a substitute for a lawyer.** Read findings as potential concerns, not definitive legal opinions.

**Not authoritative.** Jurisdiction, context, and specific wording matter. Exetazo flags *potential* risks, not absolute right/wrong.

**Not based on arbitrary AI scores.** Final severity comes from structured rules, not LLM opinions.

---

## Technical Approach

**Deterministic Scoring:**
- Start at 100
- Subtract penalties for each finding (Critical -20, High -10, Medium -5, Low -2)
- Avoid double-counting the same underlying issue
- Score reflects cumulative risk, not AI confidence

**AI's Role:**
- Semantic clause detection (understands meaning, not just keywords)
- Explanation generation (why this clause is risky)
- Contradiction detection (finds conflicting statements)
- Summarization (explains in plain English)

**AI's Non-Role:**
- Determining final score
- Deciding severity levels
- Validating findings (rules do that)

---

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build extension
npm run build:extension

# Build backend
npm run build:server

# Run tests
npm run test
```

### Load Extension in Chrome

1. Run `npm run build:extension`
2. Open `chrome://extensions`
3. Enable **Developer Mode** (top right)
4. Click **Load Unpacked**
5. Select the `extension/dist` folder
6. Open any legal webpage (try a SaaS Terms of Service)
7. Click the Exetazo icon → Scan

---

## Project Structure

```
exetazo/
├── extension/              # Chrome Manifest V3 extension
│   ├── manifest.json
│   ├── content/            # Content script (text extraction)
│   ├── sidepanel/          # Report display
│   ├── popup/              # Quick launcher
│   └── assets/
│
├── server/                 # Analysis backend
│   ├── api/                # Express/HTTP endpoints
│   ├── analyzer/           # Clause detection + analysis
│   ├── rules/              # 15 risk categories + logic
│   ├── scoring/            # Deterministic score calculation
│   └── llm/                # LLM integration (semantic)
│
├── shared/                 # Shared TypeScript types
│   └── types.ts            # Finding schema, API contracts
│
├── web/                    # Landing page (static)
│   └── index.html
│
├── tests/                  # Automated tests
│   ├── extraction.test.ts
│   ├── rules.test.ts
│   ├── scoring.test.ts
│   └── integration.test.ts
│
└── README.md (this file)
```

---

## Data Privacy

**Exetazo minimizes data retention:**

- Legal text is analyzed server-side, then discarded
- Full document is never logged or stored by default
- Only structured findings (IDs, categories, severity) persist
- Never sells or shares user data
- Clear privacy policy on landing page

**Secrets stay server-side:**
- API keys, LLM credentials, model endpoints — never in browser
- Extension communicates only via HTTPS API calls
- No credentials in extension source, content scripts, or `.env` files

---

## Legal Disclaimer

Exetazo is an educational and risk-detection tool. It:

- Does NOT provide legal advice
- Does NOT create an attorney-client relationship
- Does NOT guarantee a clause is legal or illegal
- Does NOT replace a lawyer
- Flags *potential concerns* for human review

Jurisdiction, context, and specific wording all matter. Always consult a lawyer for important agreements.

---

## Demo Flow (Hackathon)

```
1. Open real legal webpage (e.g., Notion's Terms of Service)
2. Click Exetazo extension icon
3. Hit "Scan"
4. Wait for analysis (2–5 seconds)
5. See report: "42 / 100 HIGH RISK"
6. Read severity counts (4 Critical, 3 High, 3 Medium, 2 Low)
7. Click "Unilateral Modification" finding
8. Page scrolls and highlights the actual clause (lime, settling to lavender)
9. Side panel shows:
   - EVIDENCE: "We reserve the right to modify these terms at any time..."
   - EXPLANATION: "Company can change terms without notice or consent..."
   - RECOMMENDATION: "Negotiate a clause requiring 30-day notice..."
   - CONFIDENCE: 95%
```

### Reproducible demo

Run the backend **rules-only** so the score is pure rules and re-scanning the same
page always reproduces it:

```bash
env -u OPENAI_API_KEY -u OPENAI_BASE_URL -u OPENAI_MODEL npm run start:server
```

With semantic analysis enabled the model can contribute findings the rules
missed, and those findings subtract from the score — so two scans of the same
page could differ. Verify the whole path at any time (five live policies, each
scanned twice, with the determinism verdict):

```bash
npm run validate:pages
```

---

## Build Order

**Phase 1 (Must Ship):**
- Manifest V3 + content extraction + side panel UI
- Backend analysis API + finding schema
- First 5 risk rules (unilateral modification, arbitration, class waiver, auto-renewal, cancellation)
- Deterministic scoring (no AI yet)

**Phase 2 (If Time):**
- Remaining 10 risk categories
- AI semantic analysis + explanations
- Source clause highlighting
- Landing page

**Phase 3 (Polish):**
- Contradiction detection
- False positive/negative review
- Performance optimization
- UI refinement

---

## Priorities

1. **Accuracy** — Better to flag fewer findings correctly than flood users with false positives
2. **Evidence** — Every finding must point to actual text
3. **Determinism** — Score and severity must be reproducible
4. **Speed** — Scan should complete in <5 seconds
5. **Clarity** — Users understand what the tool found and why it matters

---

## Testing

Test against real legal documents with:
- Long documents (10k+ words)
- Dense legalese
- Multiple sections and subsections
- Navigation noise (headers, footers, sidebars)
- Auto-generated content
- Contradictory language

Automated tests cover:
- Text extraction (handles noise, preserves legal text)
- Clause detection (finds target patterns)
- Rule evaluation (all 15 categories work correctly)
- Scoring (reproducible, no double-counting)
- API contracts (extension ↔ backend communication)
- Error handling (graceful degradation)

---

## Resources

**Hackathon:**
- LexHack 2026 Devpost: https://lexhack-2026.devpost.com/
- Submission Deadline: Friday, June 12, 2026 at 10:00 PM EST
- Demo Day: Saturday, June 13, 2026 (presentations + judging)
- Prizes: Free .xyz domain for all participants, Adaption Labs premium access, referral awards ($500/$300/$200)
- Goal: Help your project actually launch, not gather dust

**Chrome Extension Development:**
- Chrome Extension Dev Guide: https://developer.chrome.com/docs/extensions/
- Manifest V3 Spec: https://developer.chrome.com/docs/extensions/mv3/
- Content Scripts: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
- Side Panels API: https://developer.chrome.com/docs/extensions/reference/sidePanel/
- Service Workers: https://developer.chrome.com/docs/extensions/mv3/service_workers/

**Privacy & Security:**
- Chrome Extension Privacy Best Practices: https://support.google.com/chrome?p=ext_privacy_best_practices
- Content Security Policy: https://developer.chrome.com/docs/extensions/mv3/content_security_policy/
- Data Privacy Guidelines: https://www.privacyshield.gov/

**Legal & Compliance:**
- Legal Terms of Service Analysis: https://www.eff.org/deeplinks (EFF resource for digital rights)
- Consumer Rights: https://www.consumer.ftc.gov/
- GDPR Compliance (for EU users): https://gdpr-info.eu/

**AI & NLP:**
- OpenAI API Docs: https://platform.openai.com/docs/api-reference
- LLM Safety: https://openai.com/safety/
- Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- Prompt Engineering: https://platform.openai.com/docs/guides/prompt-engineering

**Testing & Quality:**
- Jest Testing Library: https://jestjs.io/
- Testing Best Practices: https://developer.chrome.com/docs/extensions/mv3/testing/
- Real Legal Documents for Testing: Use actual ToS from Notion, Stripe, GitHub, AWS for test suite

**Deployment & Hosting:**
- Chrome Web Store Publishing: https://developer.chrome.com/docs/webstore/publish/
- Vercel (Backend API): https://vercel.com/docs
- GitHub Actions (CI/CD): https://docs.github.com/en/actions

**Community & Help:**
- Chrome Extensions Discord (Google-run): https://discord.gg/ChromeExtensions
- LexHack 2026 Discord: [Invite link in Devpost submission]
- Stack Overflow Tags: `google-chrome-extension`, `manifest-v3`

---

**Built for LexHack 2026**

**Exetazo — Legal security before you agree.**
