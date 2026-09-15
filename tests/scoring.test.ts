import { Finding, RiskCategory, Severity } from '../shared/types';
import { riskLevelFor, scoreFindings, SEVERITY_PENALTIES } from '../server/scoring/score';

let counter = 0;
function makeFinding(severity: Severity, id?: string, category: RiskCategory = 'unilateral-modification'): Finding {
  counter += 1;
  return {
    id: id ?? `test-finding-${counter}`,
    category,
    severity,
    title: 'Test finding',
    evidence: 'We may modify these terms at any time.',
    location: { paragraphIndex: 0, excerptStart: 0, excerptEnd: 40 },
    explanation: 'test',
    recommendation: 'test',
    confidence: 80,
  };
}

describe('deterministic scoring', () => {
  it('returns a perfect score when there are no findings', () => {
    const result = scoreFindings([]);
    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe('low');
    expect(result.counts).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it('applies the fixed penalty for each severity level', () => {
    expect(SEVERITY_PENALTIES).toEqual({ critical: 20, high: 10, medium: 5, low: 2 });

    expect(scoreFindings([makeFinding('critical')]).score).toBe(80);
    expect(scoreFindings([makeFinding('high')]).score).toBe(90);
    expect(scoreFindings([makeFinding('medium')]).score).toBe(95);
    expect(scoreFindings([makeFinding('low')]).score).toBe(98);
  });

  it('accumulates penalties across multiple findings', () => {
    const findings = [
      makeFinding('critical'),
      makeFinding('critical'),
      makeFinding('high'),
      makeFinding('medium'),
      makeFinding('low'),
    ];
    // 100 - 20 - 20 - 10 - 5 - 2 = 43 → HIGH RISK band, matches README example
    const result = scoreFindings(findings);
    expect(result.score).toBe(43);
    expect(result.riskLevel).toBe('high');
    expect(result.counts).toEqual({ critical: 2, high: 1, medium: 1, low: 1 });
  });

  it('clamps the floor at 0 when penalties exceed 100', () => {
    const findings = Array.from({ length: 8 }, () => makeFinding('critical'));
    const result = scoreFindings(findings);
    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe('critical');
  });

  it('counts duplicate finding IDs once (no double-counting)', () => {
    const dup = makeFinding('critical', 'dup-1');
    const result = scoreFindings([dup, { ...dup }, dup]);
    expect(result.score).toBe(80);
    expect(result.counts.critical).toBe(1);
  });

  it('is reproducible: same findings → same score, every time', () => {
    const findings = [makeFinding('critical'), makeFinding('high'), makeFinding('medium'), makeFinding('low')];
    const first = scoreFindings(findings);
    for (let i = 0; i < 5; i += 1) {
      expect(scoreFindings(findings)).toEqual(first);
    }
  });

  it('maps score bands to risk levels at the boundaries', () => {
    expect(riskLevelFor(100)).toBe('low');
    expect(riskLevelFor(80)).toBe('low');
    expect(riskLevelFor(79)).toBe('moderate');
    expect(riskLevelFor(60)).toBe('moderate');
    expect(riskLevelFor(59)).toBe('high');
    expect(riskLevelFor(30)).toBe('high');
    expect(riskLevelFor(29)).toBe('critical');
    expect(riskLevelFor(0)).toBe('critical');
  });
});
