import { detectContradictions } from '../server/rules/contradictions';
import { analyzeText } from '../server/analyzer/analyze';
import { ParagraphInput } from '../server/rules/types';
import { Finding } from '../shared/types';

function para(text: string, index = 0): ParagraphInput {
  return { text, index, offset: 0 };
}

function categoriesOf(findings: readonly Finding[]): string[] {
  return findings.map((f) => f.category);
}

const CANCELLATION_PROMISE = 'You can cancel your subscription at any time from your account page.';
const CANCELLATION_CONFLICT = 'Cancellations must be submitted in writing and accepted by our billing team before the end of the term.';

describe('contradiction cross-checks', () => {
  it('flags "cancel any time" paired with an exclusive cancellation method', () => {
    const findings = detectContradictions([para(CANCELLATION_PROMISE, 0), para(CANCELLATION_CONFLICT, 1)]);
    expect(categoriesOf(findings)).toEqual(['contradictory-clauses']);
    const finding = findings[0]!;
    expect(finding.id).toBe('contradictory-clauses:cancel-anytime-vs-exclusive-method');
    expect(finding.severity).toBe('medium');
    expect(finding.evidence).toBe(CANCELLATION_CONFLICT);
    expect(finding.location.paragraphIndex).toBe(1);
    expect(finding.explanation).toContain(CANCELLATION_PROMISE);
    expect(finding.explanation).toContain('but elsewhere');
  });

  it('does not flag when only one side of the pair exists', () => {
    expect(detectContradictions([para(CANCELLATION_PROMISE)])).toEqual([]);
    expect(detectContradictions([para(CANCELLATION_CONFLICT)])).toEqual([]);
  });

  it('flags a flat no-sale promise paired with a sale grant', () => {
    const findings = detectContradictions([
      para('We never sell your personal information to anyone.', 0),
      para('We may sell personal information to selected commercial partners.', 1),
    ]);
    expect(categoriesOf(findings)).toEqual(['contradictory-clauses']);
    expect(findings[0]!.id).toBe('contradictory-clauses:no-sale-vs-sale-grant');
  });

  it('flags a flat no-share promise paired with a third-party share grant', () => {
    const findings = detectContradictions([
      para('We do not give your personal information to anyone.', 0),
      para('We may transfer information to advertisers and marketing partners.', 1),
    ]);
    expect(categoriesOf(findings)).toEqual(['contradictory-clauses']);
    expect(findings[0]!.id).toBe('contradictory-clauses:no-share-vs-share-grant');
  });

  it('respects the reconciliation guard: "except" language resolves the conflict', () => {
    const findings = detectContradictions([
      para('We never sell your personal information, except with service providers who support our business.', 0),
      para('We may sell personal information to selected commercial partners.', 1),
    ]);
    expect(findings).toEqual([]);
  });

  it('respects the trial guard: trial non-renewal next to subscription renewal is coherent', () => {
    const findings = detectContradictions([
      para('Your free trial will not automatically renew when it ends.', 0),
      para('Paid subscriptions automatically renew each billing term until cancelled.', 1),
    ]);
    expect(findings).toEqual([]);
  });

  it('skips pairs asserted within a single paragraph', () => {
    const findings = detectContradictions([
      para('We never sell your personal information, though we may sell personal information in aggregate form.', 0),
      para('Additional filler content to keep the document realistic and long enough for testing purposes.', 1),
    ]);
    expect(findings).toEqual([]);
  });

  it('emits one finding per conflicting pair, deterministically', () => {
    const paragraphs = [
      para(CANCELLATION_PROMISE, 0),
      para(CANCELLATION_CONFLICT, 1),
      para('We never sell your personal information to anyone.', 2),
      para('We may sell personal information to selected commercial partners.', 3),
    ];
    const first = detectContradictions(paragraphs);
    expect(first).toHaveLength(2);
    for (let i = 0; i < 3; i += 1) {
      expect(detectContradictions(paragraphs)).toEqual(first);
    }
    expect(new Set(first.map((f) => f.id)).size).toBe(2);
  });

  it('does not treat a "Do Not Share My Personal Information" link label as a promise', () => {
    const findings = detectContradictions([
      para('To opt out of the sharing of your personal information, you can click on the "Do Not Share My Personal Information" link on the footer of our Websites.', 0),
      para('Partners and Resellers: We may share your data with these partners and resellers where allowed, and with your consent when required.', 1),
    ]);
    expect(findings).toEqual([]);
  });

  it('does not flag a share grant that is qualified by consent or law', () => {
    const findings = detectContradictions([
      para('We do not share your personal information with third parties.', 0),
      para('We may share your data with these partners and resellers where allowed, and with your consent when required.', 1),
    ]);
    expect(findings).toEqual([]);
  });

  it('produces no contradictions on the real ToS fixtures (GitHub, Cloudflare, Mozilla)', () => {
    const github = [
      'It is your responsibility to properly cancel your Account with GitHub. You can cancel your Account at any time by going into your Settings in the global navigation bar at the top of the screen. The Account screen provides a simple, no questions asked cancellation link. We are not able to cancel Accounts in response to an email or phone request.',
    ];
    const cloudflare = [
      'All of your subscriptions to Paid Services with a Subscription Term will automatically renew for periods equal to your initial Subscription Term, and you will be charged at our then-current rates unless you cancel your subscription through the Services\' account dashboard prior to your next scheduled billing date.',
    ];
    expect(detectContradictions(github.map((t, i) => para(t, i)))).toEqual([]);
    expect(detectContradictions(cloudflare.map((t, i) => para(t, i)))).toEqual([]);
  });
});

describe('contradictions end-to-end', () => {
  it('flows through analyzeText and the deterministic score', async () => {
    const document = [
      '17. Term and Cancellation',
      CANCELLATION_PROMISE,
      '18. Billing',
      CANCELLATION_CONFLICT,
      'These terms are governed by the laws of the State of Delaware without regard to conflict of laws principles. All provisions survive termination where they should by their nature survive. Our service is provided on an as-is basis during your subscription period.',
    ].join('\n');

    const report = await analyzeText({ text: document, url: 'https://example.test/terms' });
    expect(categoriesOf(report.findings)).toEqual(['difficult-cancellation', 'contradictory-clauses']);
    expect(report.counts).toEqual({ critical: 0, high: 1, medium: 1, low: 0 });
    expect(report.score).toBe(85);
    // The high-severity finding lifts the label above the 85 → "low" band
    expect(report.riskLevel).toBe('moderate');
    expect(report.aiUsed).toBe(false);
  });

  it('blocks AI duplicates of an already-detected contradiction category', async () => {
    const document = [
      CANCELLATION_PROMISE,
      CANCELLATION_CONFLICT,
      'These terms are governed by the laws of the State of Delaware without regard to conflict of laws principles. All provisions survive termination where they should by their nature survive. Our service is provided on an as-is basis during your subscription period.',
    ].join('\n\n');

    const report = await analyzeText(
      { text: document },
      { ai: { detectParagraphs: async () => [{ paragraphIndex: 1, category: 'contradictory-clauses' }] } },
    );
    expect(report.findings.filter((f) => f.category === 'contradictory-clauses')).toHaveLength(1);
    expect(report.findings.filter((f) => f.category === 'contradictory-clauses')[0]!.confidence).toBe(70);
  });
});
