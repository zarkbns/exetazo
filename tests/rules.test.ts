import { Finding, RISK_CATEGORIES, RiskCategory, Severity } from '../shared/types';
import { evaluateRules } from '../server/rules/engine';
import { ruleFor, RULES } from '../server/rules/catalog';
import { ParagraphInput } from '../server/rules/types';

function para(text: string, index = 0, offset = 0): ParagraphInput {
  return { text, index, offset };
}

const POSITIVE_CASES: ReadonlyArray<[RiskCategory, string]> = [
  ['unilateral-modification', 'We reserve the right to modify these Terms at any time and without prior notice.'],
  ['unilateral-modification', 'We may amend this Agreement upon posting the revised version.'],
  ['mandatory-arbitration', 'Any dispute shall be finally resolved by binding arbitration rather than in court.'],
  ['mandatory-arbitration', 'You waive your right to a trial by jury to the fullest extent permitted by law.'],
  ['class-action-waiver', 'You agree that disputes will not be brought on a class basis.'],
  ['class-action-waiver', 'Claims may not be brought as a class action in any forum.'],
  ['automatic-renewal', 'Your subscription will automatically renew each month until you cancel.'],
  ['automatic-renewal', 'This plan continues unless you cancel before the renewal date.'],
  ['difficult-cancellation', 'To cancel, you must call customer support or send written notice by mail.'],
  ['difficult-cancellation', 'Cancellations must be submitted in writing and accepted by our billing team.'],
  ['broad-liability-limitation', 'IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, OR PUNITIVE DAMAGES.'],
  ['broad-indemnification', 'You agree to indemnify, defend, and hold harmless the Company against any and all claims, damages, and expenses, including attorneys\' fees.'],
  ['broad-data-sharing', 'We may share your personal information with third parties for any purpose, including advertising.'],
  ['broad-data-sharing', 'We disclose personal data to marketing partners and data brokers.'],
  ['data-sale-permission', 'We may sell your personal information to interested parties.'],
  ['data-retention-ambiguity', 'We retain your information for as long as necessary.'],
  ['account-termination', 'We may suspend or terminate your account at any time, for any reason, without notice.'],
  ['venue-jurisdiction', 'You agree to submit to the exclusive jurisdiction of the courts located in Delaware.'],
  ['hidden-fees', 'All fees are subject to change at any time without notice.'],
  ['broad-ip-ownership', 'You hereby grant us a perpetual, irrevocable license to use your content in any way we see fit.'],
  ['broad-ip-ownership', 'You grant each party who has access to the project a nonexclusive, worldwide, irrevocable license to use, reproduce, prepare derivatives, distribute, perform, and display Contributed Content you contribute as an End User.'],
  ['broad-indemnification', 'As permitted by applicable law, you agree to release, indemnify, and hold harmless AWS and its affiliates from and against any liability relating to any acts or omissions of such third parties.'],
  ['data-retention-ambiguity', 'We’ll retain your Personal Data as long as your account is active and as needed to fulfill contractual obligations, comply with legal requirements, resolve disputes, and enforce agreements.'],
];

const NEGATIVE_CASES: ReadonlyArray<[RiskCategory, string]> = [
  ['unilateral-modification', 'We will provide at least 30 days notice before material changes to these terms take effect.'],
  ['unilateral-modification', 'Changes to the pricing page are described on our blog.'],
  ['mandatory-arbitration', 'Arbitration is optional; you may opt out within 30 days of accepting these terms.'],
  ['mandatory-arbitration', 'You keep every right to sue in a court of law.'],
  ['class-action-waiver', 'You may participate in a class action against us without restriction.'],
  ['automatic-renewal', 'Your plan will not automatically renew at the end of the term.'],
  ['automatic-renewal', 'Renewal reminders are emailed seven days before billing.'],
  ['difficult-cancellation', 'You can cancel at any time online from your account settings.'],
  ['broad-liability-limitation', 'We are liable for damages caused by our own gross negligence.'],
  ['broad-data-sharing', 'We do not share your personal information with third parties except as you direct.'],
  ['data-sale-permission', 'We do not sell your personal information. Never have.'],
  ['data-retention-ambiguity', 'We retain your information for 24 months after account closure, then delete it.'],
  ['account-termination', 'We may terminate your account for material breach of these terms after notice.'],
  ['venue-jurisdiction', 'This agreement is governed by the laws of California, without regard to conflict-of-laws rules.'],
  ['venue-jurisdiction', 'Disputes may be brought in small claims court in the county where you live.'],
  ['hidden-fees', 'Fees will not increase during your subscription term.'],
  ['broad-ip-ownership', 'You retain ownership of all content you create; we claim no ownership.'],
  ['broad-ip-ownership', 'You grant us a worldwide, royalty-free license to host, store, and display your content solely to operate the service.'],

  // Real-world false positives caught by scanning live policies (2026-09-20).
  // Each one quotes the clause that used to trigger a wrong finding.
  ['data-sale-permission', 'You may not use the API to download data or Content from GitHub for spamming purposes, including for the purposes of selling GitHub users\' personal information, such as to recruiters, headhunters, and job boards.'],
  ['data-sale-permission', 'We do not “sell” or “share” the personal information of known minors under 16 years of age.'],
  ['data-sale-permission', 'For each Seller, we will collect the necessary data and tax forms to enable compliance with applicable tax laws.'],
  ['mandatory-arbitration', 'An individual has the possibility, under certain conditions, to invoke binding arbitration for complaints regarding DPF compliance not resolved by any of the other DPF mechanisms.'],
  ['broad-ip-ownership', "By making a repository public, you grant other Users a nonexclusive, worldwide license to use, display, perform and reproduce (by forking) Your Content through the Service as permitted by GitHub's functionality."],
  ['automatic-renewal', 'AWS may change, discontinue, or deprecate support for a Security Offering (within the AWS Security Hub Extended plan) at any time. Upon discontinuation or deprecation of support for a Security Offering, your access to that Security Offering through the Security Hub Extended plan will be discontinued.'],
  ['data-retention-ambiguity', 'The obligations under this Section 50.10 will apply only if you: (a) give AWS prompt written notice of the claim; (b) permit AWS to control the defense of the claim; (c) retain and provide sufficient records to the extent necessary to evaluate your eligibility for the defense of claims and indemnity set forth in this Section 50.10.'],
  ['broad-indemnification', 'Each Seller will indemnify us and our affiliates against any claim or demand for payment of any Taxes imposed in connection with any Transaction, and for any fines, penalties, or similar charges imposed as a result of the Seller’s failure to collect, remit, or report any Taxes in connection with any Transaction.'],
  ['difficult-cancellation', 'Either you or AWS may cancel your EST engagement with 15 days written notice, which may be via email. AWS will charge you for the full month during which the cancellation takes effect.'],
  ['unilateral-modification', "Short version: We want our users to be informed of important changes to our terms, but some changes aren't that important — we don't want to bother you every time we fix a typo. So while we may modify this agreement at any time, we will notify users of any material changes and give you time to adjust to them."],
  ['hidden-fees', 'If you agree to a subscription price, that will remain your price for the duration of the payment term; however, prices are subject to change at the end of a payment term.'],
];

/** A fair, consumer-friendly document — the false-positive control. */
const BENIGN_DOCUMENT: string[] = [
  'You retain ownership of all content you create and upload to the service.',
  'We will provide at least 30 days notice before material changes to these terms take effect.',
  'Your plan will not automatically renew at the end of each billing term.',
  'You can cancel at any time online in your account settings, effective immediately.',
  'We do not sell your personal information and we do not share it except as you direct.',
  'We retain your data for 30 days after account deletion, then purge all backups.',
  'This agreement is governed by the laws of California, without regard to conflict-of-laws rules.',
  'Disputes may be brought in small claims court in the county where you live.',
  'The service is provided as is and as available during the subscription term.',
  'We may terminate your account for material breach of these terms after written notice.',
  'Fees for the service are stated on the pricing page and will not increase mid-term.',
];

function categoryOf(findings: readonly Finding[]): RiskCategory[] {
  return findings.map((f) => f.category);
}

describe('rules catalog', () => {
  it('defines exactly the 15 shared categories', () => {
    expect(RULES).toHaveLength(15);
    expect(new Set(RULES.map((r) => r.category))).toEqual(new Set(RISK_CATEGORIES));
  });

  it('gives every rule a definition, rationale, recommendation, and confidence', () => {
    for (const rule of RULES) {
      expect(rule.definition.length).toBeGreaterThan(20);
      expect(rule.rationale.length).toBeGreaterThan(20);
      expect(rule.recommendation.length).toBeGreaterThan(20);
      expect(rule.baseConfidence).toBeGreaterThan(0);
      expect(rule.baseConfidence).toBeLessThanOrEqual(100);
    }
  });

  it('keeps contradictory-clauses pattern-free; it detects via cross-check pairs instead', () => {
    expect(ruleFor('contradictory-clauses').patterns).toEqual([]);
  });
});

describe('rule evaluation — true positives', () => {
  for (const [category, text] of POSITIVE_CASES) {
    it(`flags ${category} for: "${text.slice(0, 60)}…"`, () => {
      const findings = evaluateRules([para(text)]);
      expect(categoryOf(findings)).toContain(category);

      const finding = findings.find((f) => f.category === category)!;
      expect(finding.evidence).toBe(text.trim());
      expect(finding.severity).toBe(ruleFor(category).severity);
      expect(finding.location.excerptStart).toBe(0);
      expect(finding.location.excerptEnd).toBe(text.trim().length);
    });
  }
});

describe('rule evaluation — false-positive controls', () => {
  for (const [category, text] of NEGATIVE_CASES) {
    it(`does not flag benign ${category} language: "${text.slice(0, 50)}…"`, () => {
      const findings = evaluateRules([para(text)]);
      expect(categoryOf(findings)).not.toContain(category);
    });
  }

  it('produces zero findings on a fair, consumer-friendly document', () => {
    const paragraphs = BENIGN_DOCUMENT.map((text, i) => para(text, i));
    expect(evaluateRules(paragraphs)).toEqual([]);
  });
});

describe('negation suppressions (paragraph-scoped)', () => {
  it('suppresses modification when advance notice is promised', () => {
    const text = 'We may modify these terms at any time. We will provide you 30 days notice.';
    expect(categoryOf(evaluateRules([para(text)]))).not.toContain('unilateral-modification');
  });

  it('suppresses arbitration when an opt-out exists', () => {
    const text = 'All disputes shall be resolved by binding arbitration, but you may opt out within 30 days.';
    expect(categoryOf(evaluateRules([para(text)]))).not.toContain('mandatory-arbitration');
  });
});

describe('double-counting protection', () => {
  const repeated = [
    para('We reserve the right to modify these Terms at any time.', 0),
    para('We may update the terms of service at any time without notice.', 1),
    para('We reserve the right to modify these Terms at any time.', 2),
  ];

  it('emits one finding per category by default', () => {
    const findings = evaluateRules(repeated);
    expect(categoryOf(findings).filter((c) => c === 'unilateral-modification')).toHaveLength(1);
  });

  it('still dedupes identical evidence when onePerCategory is off', () => {
    const findings = evaluateRules(repeated, { onePerCategory: false });
    const uni = findings.filter((f) => f.category === 'unilateral-modification');
    expect(uni).toHaveLength(2);
    expect(new Set(uni.map((f) => f.id)).size).toBe(2);
  });

  it('derives deterministic IDs from category + normalized evidence', () => {
    const [fuzzy] = evaluateRules(
      [para('  We   RESERVE  the right to modify these Terms at any time. ', 0)],
      { onePerCategory: false },
    );
    const [clean] = evaluateRules(
      [para('We reserve the right to modify these Terms at any time.', 0)],
      { onePerCategory: false },
    );
    expect(fuzzy?.id).toBe(clean?.id);
  });
});

describe('determinism and ordering', () => {
  const paragraphs = POSITIVE_CASES.map(([category, text], i) => para(text, i));

  it('is reproducible: same paragraphs → same findings, every time', () => {
    const first = evaluateRules(paragraphs);
    for (let i = 0; i < 3; i += 1) {
      expect(evaluateRules(paragraphs)).toEqual(first);
    }
  });

  it('emits findings in stable category order', () => {
    const categories = categoryOf(evaluateRules(paragraphs));
    const canonical = [...categories].sort(
      (a, b) => RISK_CATEGORIES.indexOf(a) - RISK_CATEGORIES.indexOf(b),
    );
    expect(categories).toEqual(canonical);
  });

  it('maps evidence back to source via paragraph offsets', () => {
    const findings = evaluateRules([
      para('intro paragraph with no findings', 0, 0),
      para('We may sell your personal information to interested parties.', 1, 36),
    ]);
    const sale = findings.find((f) => f.category === 'data-sale-permission')!;
    expect(sale.location.paragraphIndex).toBe(1);
    expect(sale.location.excerptStart).toBe(36);
    expect(sale.location.excerptEnd).toBe(36 + sale.evidence.length);
  });
});

describe('severity assignments', () => {
  it('matches the documented severity model', () => {
    const expected: Record<RiskCategory, Severity> = {
      'unilateral-modification': 'critical',
      'mandatory-arbitration': 'critical',
      'class-action-waiver': 'high',
      'automatic-renewal': 'medium',
      'difficult-cancellation': 'high',
      'broad-liability-limitation': 'high',
      'broad-indemnification': 'high',
      'broad-data-sharing': 'critical',
      'data-sale-permission': 'high',
      'data-retention-ambiguity': 'low',
      'account-termination': 'medium',
      'venue-jurisdiction': 'low',
      'hidden-fees': 'medium',
      'broad-ip-ownership': 'high',
      'contradictory-clauses': 'medium',
    };
    for (const rule of RULES) {
      expect(rule.severity).toBe(expected[rule.category]);
    }
  });
});
