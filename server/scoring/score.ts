import { Finding, RiskLevel, Severity, SeverityCounts } from '../../shared/types';

/**
 * Deterministic scoring: start at 100, subtract a fixed integer penalty per
 * finding. No AI output, no floats — the same findings always produce the
 * same score.
 */
export const SEVERITY_PENALTIES: Record<Severity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
};

export const MAX_SCORE = 100;
export const MIN_SCORE = 0;

/**
 * Risk bands, aligned with the README report example (42 → HIGH RISK):
 *   80–100 low | 60–79 moderate | 30–59 high | 0–29 critical
 *
 * The band from the score is then lifted by a severity floor: a document
 * containing a critical finding is never labeled below 'high', and one
 * containing a high finding never below 'moderate'. Without this, a single
 * mandatory-arbitration clause (−20) would read "80/100 LOW RISK" — a label
 * that contradicts the finding's own severity.
 */
export function riskLevelFor(score: number): RiskLevel {
  if (score >= 80) return 'low';
  if (score >= 60) return 'moderate';
  if (score >= 30) return 'high';
  return 'critical';
}

const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

function severityFloor(counts: SeverityCounts): RiskLevel {
  if (counts.critical > 0) return 'high';
  if (counts.high > 0) return 'moderate';
  return 'low';
}

export interface ScoreResult {
  score: number;
  riskLevel: RiskLevel;
  counts: SeverityCounts;
}

/**
 * Score a set of findings.
 *
 * Only score-affecting findings count: the deterministic rules engine decides
 * what a document's score is, and semantic (AI) findings are advisory context
 * that can never move it. Duplicate finding IDs are counted once — a
 * defensive second layer against double-counting the same underlying issue.
 */
export function scoreFindings(findings: readonly Finding[]): ScoreResult {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const seen = new Set<string>();
  let penalty = 0;

  for (const finding of findings) {
    if (!finding.scoreAffecting) continue;
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    counts[finding.severity] += 1;
    penalty += SEVERITY_PENALTIES[finding.severity];
  }

  const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, MAX_SCORE - penalty));
  const band = riskLevelFor(score);
  const floor = severityFloor(counts);
  const riskLevel = LEVEL_RANK[floor] > LEVEL_RANK[band] ? floor : band;
  return { score, riskLevel, counts };
}
