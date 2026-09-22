/**
 * @jest-environment jsdom
 *
 * DOM-level tests for the content script, run against a verbatim copy of a live
 * Terms of Service page (tests/fixtures/github-tos.html.gz, gzipped to keep the
 * repository small) plus a synthetic page covering the cases that break naive
 * anchoring: a clause repeated in two sections, clauses inside table cells, and
 * hostile page text.
 *
 * Not covered here (needs a real browser): text injected by client-side
 * rendering after load. The content script runs after render, so it sees the
 * rendered DOM; jsdom cannot reproduce that.
 */
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';

// The content script registers a chrome.runtime listener at import time.
(globalThis as { chrome?: unknown }).chrome = {
  runtime: { onMessage: { addListener: () => undefined } },
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractLegalText, highlightEvidence } = require('../extension/src/content') as typeof import('../extension/src/content');

const FIXTURE = join(__dirname, 'fixtures', 'github-tos.html.gz');

// jsdom implements no scrolling; the content script only needs the call not to throw.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

function realPage(): string {
  return gunzipSync(readFileSync(FIXTURE)).toString('utf8');
}

function load(html: string): void {
  // Assigning innerHTML rather than document.write: same parse, and jsdom's
  // document.write is markedly slower under jest on a full page.
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = body?.[1] ?? html;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  document.title = title?.[1]?.trim() ?? '';
}

function marks(): HTMLElement[] {
  return Array.from(document.querySelectorAll('mark[data-exetazo]')) as HTMLElement[];
}

/** The single highlight, or a failure — keeps the assertions readable. */
function firstMark(): HTMLElement {
  const [mark] = marks();
  if (!mark) throw new Error('expected exactly one highlight, found none');
  return mark;
}

const REAL_CLAUSE =
  'GitHub has the right to suspend or terminate your access to all or any part of the Website at any time, with or without cause, with or without notice, effective immediately.';

describe('extraction on a real Terms of Service page', () => {
  beforeEach(() => load(realPage()));

  it('keeps the operative clause text verbatim', () => {
    const { text } = extractLegalText();
    expect(text).toContain(REAL_CLAUSE);
    expect(text.split(/\s+/).filter(Boolean).length).toBeGreaterThan(1000);
  });

  it('drops navigation, header, footer, and cookie chrome', () => {
    const { text } = extractLegalText();
    expect(text).not.toContain('Skip to content');
    expect(text).not.toContain('Search GitHub Docs');
    expect(text).not.toContain('Sign up');
    // The site footer's copyright line goes, while the body's own IP clause
    // ("…is copyright © GitHub, Inc. All rights reserved.") stays.
    expect(text).not.toContain('GitHub Inc. © 2026');
  });

  it('reports the page title for the report header', () => {
    expect(extractLegalText().title.length).toBeGreaterThan(0);
  });

  it('highlights the clause it extracted, in place', () => {
    expect(highlightEvidence(REAL_CLAUSE)).toBe(true);
    const found = marks();
    expect(found).toHaveLength(1);
    expect(firstMark().textContent).toContain(REAL_CLAUSE);
  });

  it('yields too little text on a page that is not an agreement', () => {
    load('<html><body><nav>Menu</nav><button>Accept all</button><p>Sign in to continue</p></body></html>');
    const words = extractLegalText().text.split(/\s+/).filter(Boolean).length;
    // Under MIN_LEGAL_WORDS the server returns the clear not-legal-text state.
    expect(words).toBeLessThan(60);
  });
});

const CLAUSE =
  'You agree that any dispute arising out of or relating to these Terms shall be finally resolved by binding arbitration rather than in court.';

const REPEATED_PAGE = `<!DOCTYPE html><html><head><title>Repeated clauses</title></head><body>
  <nav>Products | Pricing | Sign in</nav>
  <header><h1>Service Agreement</h1></header>
  <main>
    <section id="billing"><h2>4. Billing</h2>
      <p>Fees are billed monthly in advance.</p>
      <p>${CLAUSE}</p>
    </section>
    <section id="disputes"><h2>9. Dispute Resolution</h2>
      <p>The parties will attempt to resolve disputes informally first.</p>
      <p>${CLAUSE}</p>
    </section>
    <table><caption>5. Fee schedule</caption>
      <tr><th>Plan</th><th>Terms</th></tr>
      <tr><td>Pro</td><td>Subscriptions renew automatically each month until cancelled.</td></tr>
    </table>
  </main>
  <footer>© 2026 Example Inc. Manage cookies</footer>
</body></html>`;

describe('highlighting when the same clause appears more than once', () => {
  beforeEach(() => load(REPEATED_PAGE));

  it('anchors to the section the finding was reported from', () => {
    expect(highlightEvidence(CLAUSE, '9. Dispute Resolution')).toBe(true);
    expect(firstMark().closest('section')?.id).toBe('disputes');
  });

  it('anchors to a different section when the finding says so', () => {
    expect(highlightEvidence(CLAUSE, '4. Billing')).toBe(true);
    expect(firstMark().closest('section')?.id).toBe('billing');
  });

  it('falls back to the first occurrence when no section is known', () => {
    expect(highlightEvidence(CLAUSE)).toBe(true);
    expect(firstMark().closest('section')?.id).toBe('billing');
  });

  it('clears the previous highlight before marking the next clause', () => {
    highlightEvidence(CLAUSE, '4. Billing');
    highlightEvidence(CLAUSE, '9. Dispute Resolution');
    expect(marks()).toHaveLength(1);
    expect(firstMark().closest('section')?.id).toBe('disputes');
  });

  it('finds clauses inside table cells', () => {
    expect(highlightEvidence('Subscriptions renew automatically each month until cancelled.')).toBe(true);
    expect(firstMark().closest('td')).not.toBeNull();
  });

  it('reports not-found rather than guessing', () => {
    expect(highlightEvidence('This sentence appears nowhere on this page at all.')).toBe(false);
    expect(marks()).toHaveLength(0);
  });
});

describe('untrusted page text', () => {
  const HOSTILE =
    '<img src=x onerror="window.__pwned=1"> and <script>window.__pwned=2</script> are characters here.';

  beforeEach(() => {
    load(`<!DOCTYPE html><html><body>
      <nav>Menu</nav>
      <main>
        <p>${HOSTILE.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p>We may share your personal information with third parties for any purpose we choose.</p>
      </main>
      <footer>© 2026 Example Inc.</footer>
    </body></html>`);
  });

  it('returns page text as text, never as markup or code', () => {
    const { text } = extractLegalText();
    expect(text).toContain('<img src=x onerror=');
    expect((globalThis as { __pwned?: number }).__pwned).toBeUndefined();
    expect(document.querySelector('img')).toBeNull();
  });

  it('highlights hostile text without turning it into elements', () => {
    expect(highlightEvidence(HOSTILE)).toBe(true);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect((globalThis as { __pwned?: number }).__pwned).toBeUndefined();
  });
});
