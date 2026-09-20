import { analyzeText, NotLegalTextError } from '../server/analyzer/analyze';
import { cleanText } from '../server/analyzer/clean';
import { SemanticAnalyzer, AiCandidate } from '../server/llm/types';
import { ScanReport } from '../shared/types';

/** Verbatim excerpts from live legal pages (see extraction.test.ts). */
const GITHUB_TERMINATION =
  'GitHub has the right to suspend or terminate your access to all or any part of the Website at any time, with or without cause, with or without notice, effective immediately. GitHub reserves the right to refuse service to anyone for any reason at any time.';

const GITHUB_CANCELLATION =
  'It is your responsibility to properly cancel your Account with GitHub. You can cancel your Account at any time by going into your Settings in the global navigation bar at the top of the screen. The Account screen provides a simple, no questions asked cancellation link. We are not able to cancel Accounts in response to an email or phone request.';

const GITHUB_MODIFICATION =
  'We reserve the right, at our sole discretion, to amend these Terms of Service at any time and will update these Terms of Service in the event of any such amendments. We will notify our Users of material changes to this Agreement, such as price increases, at least 30 days prior to the change taking effect by posting a notice on our Website or sending email to the primary email address specified in your GitHub account. Customer\'s continued use of the Service after those 30 days constitutes agreement to those revisions of this Agreement.';

const GITHUB_WEBSITE_DISCONTINUATION =
  'We reserve the right at any time and from time to time to modify or discontinue, temporarily or permanently, the Website (or any part of it) with or without notice.';

const GITHUB_VENUE =
  'You and GitHub agree to submit to the exclusive jurisdiction and venue of the courts located in the City and County of San Francisco, California.';

const CLOUDFLARE_MODIFICATION =
  'Cloudflare reserves the right to make modifications to this Agreement at any time. If a revision materially alters your rights we will use reasonable efforts to contact you, including sending a notification to the e-mail address(es) associated with your account. In some instances, such as with Free Services, you may be required to indicate your consent to the revised terms in order to continue accessing the Service. Unless otherwise specified, any modifications to this Agreement will take effect at the start of Subscription Term following the notice. If you do not agree with the revised terms, your sole and exclusive remedy will be not to renew your Subscription.';

const CLOUDFLARE_ARBITRATION =
  'In the interest of resolving disputes between you and Cloudflare in the most expedient and cost effective manner, you and Cloudflare agree that any and all disputes arising in connection with this Agreement will be resolved by binding arbitration.';

const CLOUDFLARE_JURY_CLASS =
  'YOU UNDERSTAND AND AGREE THAT, BY ENTERING INTO THESE TERMS, YOU AND CLOUDFLARE ARE EACH WAIVING THE RIGHT TO A TRIAL BY JURY OR TO PARTICIPATE IN A CLASS ACTION.';

const CLOUDFLARE_INDIVIDUAL_CAPACITY =
  'YOU AND CLOUDFLARE AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING. Further, unless both you and Cloudflare agree otherwise, the arbitrator may not consolidate more than one person\'s claims, and may not otherwise preside over any form of a representative or class proceeding.';

const CLOUDFLARE_RENEWAL =
  'All of your subscriptions to Paid Services with a Subscription Term will automatically renew for periods equal to your initial Subscription Term, and you will be charged at our then-current rates unless you cancel your subscription through the Services\' account dashboard prior to your next scheduled billing date.';

const CLOUDFLARE_TERMINATION =
  'We may at our sole discretion terminate your user account or Suspend or terminate your use or access to the Service at any time, with or without notice for any reason or no reason at all.';

const CLOUDFLARE_PRICE_CHANGES =
  'We reserve the right to change the fees that we charge for the Service, at any time in our sole discretion, provided that we give you at least thirty (30) days\' prior notice of such changes. Unless otherwise specified in such notice to you, any changes to the subscription fees will take effect in the billing period immediately following our notice to you.';

const CLOUDFLARE_RAW = [
  'Cloudflare',
  'Products | Solutions | Pricing | Sign up',
  'Accept all — this website uses cookies.',
  '',
  '14. Changes to this Agreement',
  CLOUDFLARE_MODIFICATION,
  '',
  '17. Dispute Resolution and Arbitration',
  CLOUDFLARE_ARBITRATION,
  '',
  CLOUDFLARE_JURY_CLASS,
  '',
  '17.6 No Class Actions',
  CLOUDFLARE_INDIVIDUAL_CAPACITY,
  '',
  '2.4 Subscription Terms, Renewals, and Cancellations',
  CLOUDFLARE_RENEWAL,
  '',
  '8. Termination of Use',
  CLOUDFLARE_TERMINATION,
  '',
  '4.2 Price Changes',
  CLOUDFLARE_PRICE_CHANGES,
  '',
  '© 2026 Cloudflare, Inc.',
].join('\n');

const GITHUB_RAW = [
  'Skip to content | Sign up',
  '',
  'M. Cancellation and Termination',
  GITHUB_TERMINATION,
  GITHUB_CANCELLATION,
  '',
  'R. Changes to These Terms',
  GITHUB_MODIFICATION,
  GITHUB_WEBSITE_DISCONTINUATION,
  '',
  'S. Miscellaneous',
  GITHUB_VENUE,
].join('\n');

const MOZILLA_LIABILITY =
  'EXCEPT AS REQUIRED BY LAW, MOZILLA AND THE INDEMNIFIED PARTIES WILL NOT BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES ARISING OUT OF OR IN ANY WAY RELATING TO THESE TERMS OR THE USE OF OR INABILITY TO USE THE COMMUNICATIONS.';

const MOZILLA_RAW = [
  '10. Disclaimer; Limitation of Liability',
  MOZILLA_LIABILITY,
  '',
  '11. Modifications to These Terms',
  'We may update these Terms from time to time to address a new feature of the Communications or to clarify a provision. The updated Terms will be posted online.',
].join('\n');

function fakeAi(candidates: AiCandidate[]): SemanticAnalyzer {
  return { detectParagraphs: async () => candidates };
}

function fakeAiFailing(): SemanticAnalyzer {
  return { detectParagraphs: async () => { throw new Error('LLM unreachable'); } };
}

async function scan(text: string, ai?: SemanticAnalyzer | null): Promise<ScanReport> {
  return analyzeText({ text, url: 'https://example.test/terms' }, { ai });
}

describe('analyzer pipeline on real documents', () => {
  it('scores the Cloudflare agreement: 5 findings, 40/100 HIGH RISK', async () => {
    const report = await scan(CLOUDFLARE_RAW);
    expect(report.findings.map((f) => f.category)).toEqual([
      'unilateral-modification',
      'mandatory-arbitration',
      'class-action-waiver',
      'automatic-renewal',
      'account-termination',
    ]);
    expect(report.counts).toEqual({ critical: 2, high: 1, medium: 2, low: 0 });
    expect(report.score).toBe(40);
    expect(report.riskLevel).toBe('high');
    expect(report.aiUsed).toBe(false);
  });

  it('backs every finding with verbatim evidence and a real location', async () => {
    const report = await scan(CLOUDFLARE_RAW);
    const cleaned = cleanText(CLOUDFLARE_RAW);
    for (const finding of report.findings) {
      expect(cleaned.fullText.slice(finding.location.excerptStart, finding.location.excerptEnd)).toBe(
        finding.evidence,
      );
      expect(cleaned.paragraphs[finding.location.paragraphIndex]?.text).toBe(finding.evidence);
    }
    const arbitration = report.findings.find((f) => f.category === 'mandatory-arbitration')!;
    expect(arbitration.evidence).toBe(CLOUDFLARE_ARBITRATION);
    expect(arbitration.location.section).toBe('17. Dispute Resolution and Arbitration');
    expect(arbitration.confidence).toBe(85);
  });

  it('does not flag price changes that carry 30 days prior notice (Cloudflare 4.2)', async () => {
    const report = await scan(CLOUDFLARE_RAW);
    expect(report.findings.map((f) => f.category)).not.toContain('hidden-fees');
  });

  it('treats GitHub\'s notice-giving modification clause as non-triggering (per catalog example)', async () => {
    const report = await scan(GITHUB_RAW);
    expect(report.findings.map((f) => f.category)).not.toContain('unilateral-modification');
    expect(report.findings.map((f) => f.category)).toEqual(['account-termination', 'venue-jurisdiction']);
    expect(report.score).toBe(93);
    expect(report.riskLevel).toBe('low');
  });

  it('does not misfile GitHub\'s service-discontinuation clause as terms modification', async () => {
    const report = await scan(GITHUB_RAW);
    const uni = report.findings.filter((f) => f.category === 'unilateral-modification');
    expect(uni).toHaveLength(0);
  });

  it('flags Mozilla\'s broad liability exclusion as the sole finding', async () => {
    const report = await scan(MOZILLA_RAW);
    expect(report.findings.map((f) => f.category)).toEqual(['broad-liability-limitation']);
    expect(report.score).toBe(90);
  });

  it('is fully deterministic: same page, same report', async () => {
    const first = await scan(CLOUDFLARE_RAW);
    for (let i = 0; i < 3; i += 1) {
      expect(await scan(CLOUDFLARE_RAW)).toEqual(first);
    }
  });

  it('rejects near-empty pages as not legal text', async () => {
    await expect(scan('Sign in | Home | Accept all cookies')).rejects.toBeInstanceOf(NotLegalTextError);
  });

  it('propagates cleaning warnings into the report', async () => {
    const report = await scan('Legal line. '.repeat(50_000));
    expect(report.warnings.some((w) => w.includes('truncated'))).toBe(true);
  });
});

describe('semantic AI layer (merge + degradation)', () => {
  it('merges validated AI-only candidates with reduced confidence', async () => {
    const cleaned = cleanText(CLOUDFLARE_RAW);
    const renewalIndex = cleaned.paragraphs.findIndex((p) => p.text.includes('automatically renew'));
    expect(renewalIndex).toBeGreaterThanOrEqual(0);

    const report = await scan(
      CLOUDFLARE_RAW,
      fakeAi([{ paragraphIndex: renewalIndex, category: 'difficult-cancellation' }]),
    );
    expect(report.aiUsed).toBe(true);
    const aiFinding = report.findings.find((f) => f.category === 'difficult-cancellation')!;
    expect(aiFinding.confidence).toBe(55);
    expect(aiFinding.evidence).toBe(CLOUDFLARE_RENEWAL);
    // Advisory: it appears in the report, but the score stays rules-only.
    expect(aiFinding.source).toBe('ai');
    expect(aiFinding.scoreAffecting).toBe(false);
    expect(report.score).toBe(40);
  });

  it('never duplicates a category the rules already flagged', async () => {
    const cleaned = cleanText(CLOUDFLARE_RAW);
    const arbIndex = cleaned.paragraphs.findIndex((p) => p.text.includes('binding arbitration'));
    const report = await scan(
      CLOUDFLARE_RAW,
      fakeAi([{ paragraphIndex: arbIndex, category: 'mandatory-arbitration' }]),
    );
    expect(report.findings.filter((f) => f.category === 'mandatory-arbitration')).toHaveLength(1);
    expect(report.findings).toHaveLength(5);
  });

  it('ignores invalid AI candidates (out of range, unknown category)', async () => {
    const report = await scan(
      CLOUDFLARE_RAW,
      fakeAi([
        { paragraphIndex: 9999, category: 'mandatory-arbitration' },
        { paragraphIndex: 0, category: 'made-up-category' as never },
      ]),
    );
    expect(report.aiUsed).toBe(false);
    expect(report.findings).toHaveLength(5);
  });

  it('degrades to rules-only when the AI call fails', async () => {
    const report = await scan(CLOUDFLARE_RAW, fakeAiFailing());
    expect(report.aiUsed).toBe(false);
    expect(report.warnings).toContain('Semantic analysis unavailable — pattern rules only.');
    expect(report.findings).toHaveLength(5);
    expect(report.score).toBe(40);
  });

  it('builds AI finding evidence from the cleaned text, never from AI output', async () => {
    const cleaned = cleanText(CLOUDFLARE_RAW);
    const renewalIndex = cleaned.paragraphs.findIndex((p) => p.text.includes('automatically renew'));
    const report = await scan(
      CLOUDFLARE_RAW,
      fakeAi([{ paragraphIndex: renewalIndex, category: 'difficult-cancellation' }]),
    );
    const aiFinding = report.findings.find((f) => f.category === 'difficult-cancellation')!;
    expect(aiFinding.evidence).toBe(cleaned.paragraphs[renewalIndex]?.text);
    expect(aiFinding.title).toBe('Difficult Cancellation');
  });
});

describe('determinism boundary: the public score is rules-only', () => {
  function renewalIndexIn(document: string): number {
    return cleanText(document).paragraphs.findIndex((p) => p.text.includes('automatically renew'));
  }

  it('scores identically with and without semantic findings', async () => {
    const without = await scan(CLOUDFLARE_RAW);
    const withAi = await scan(
      CLOUDFLARE_RAW,
      fakeAi([{ paragraphIndex: renewalIndexIn(CLOUDFLARE_RAW), category: 'difficult-cancellation' }]),
    );
    expect(withAi.score).toBe(without.score);
    expect(withAi.counts).toEqual(without.counts);
    expect(withAi.riskLevel).toBe(without.riskLevel);
    // The advisory finding is still reported — it just does not score.
    expect(withAi.findings).toHaveLength(without.findings.length + 1);
  });

  it('scores identically for any set of AI candidates', async () => {
    const idx = renewalIndexIn(CLOUDFLARE_RAW);
    const one = await scan(
      CLOUDFLARE_RAW,
      fakeAi([{ paragraphIndex: idx, category: 'difficult-cancellation' }]),
    );
    const many = await scan(
      CLOUDFLARE_RAW,
      fakeAi([
        { paragraphIndex: idx, category: 'difficult-cancellation' },
        { paragraphIndex: 0, category: 'data-retention-ambiguity' },
        { paragraphIndex: 1, category: 'broad-data-sharing' },
      ]),
    );
    expect(many.score).toBe(one.score);
    expect(many.counts).toEqual(one.counts);
  });

  it('ignores free-form prose a model returns alongside its candidates', async () => {
    const rulesOnly = await scan(CLOUDFLARE_RAW);

    // A model trying to set its own severity, score, and evidence.
    const proseHeavy: SemanticAnalyzer = {
      detectParagraphs: async () =>
        [
          {
            paragraphIndex: renewalIndexIn(CLOUDFLARE_RAW),
            category: 'difficult-cancellation',
            explanation: 'The model claims this is the worst clause in the document.',
            severity: 'critical',
            score: 0,
            evidence: 'FABRICATED EVIDENCE THE MODEL INVENTED',
          },
        ] as unknown as AiCandidate[],
    };

    const report = await scan(CLOUDFLARE_RAW, proseHeavy);
    expect(report.score).toBe(rulesOnly.score);
    expect(report.counts).toEqual(rulesOnly.counts);

    const advisory = report.findings.find((f) => f.category === 'difficult-cancellation')!;
    expect(advisory.severity).toBe('high'); // the rule catalog's severity, not the model's
    expect(advisory.evidence).toBe(CLOUDFLARE_RENEWAL); // real document text, never the model's string
    expect(advisory.evidence).not.toContain('FABRICATED');
  });

  it('marks exactly the rules findings as score-affecting', async () => {
    const report = await scan(
      CLOUDFLARE_RAW,
      fakeAi([{ paragraphIndex: renewalIndexIn(CLOUDFLARE_RAW), category: 'difficult-cancellation' }]),
    );
    for (const finding of report.findings) {
      expect(finding.scoreAffecting).toBe(finding.source === 'rules');
    }
    expect(report.findings.some((f) => f.source === 'ai')).toBe(true);
  });
});
