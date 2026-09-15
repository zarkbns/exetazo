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
 */
export function riskLevelFor(score: number): RiskLevel {
  if (score >= 80) return 'low';
  if (score >= 60) return 'moderate';
  if (score >= 30) return 'high';
  return 'critical';
}

export interface ScoreResult {
  score: number;
  riskLevel: RiskLevel;
  counts: SeverityCounts;
}

/**
 * Score a set of findings. Duplicate finding IDs are counted once — a
 * defensive second layer against double-counting the same underlying issue.
 */
export function scoreFindings(findings: readonly Finding[]): ScoreResult {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const seen = new Set<string>();
  let penalty = 0;

  for (const finding of findings) {
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    counts[finding.severity] += 1;
    penalty += SEVERITY_PENALTIES[finding.severity];
  }

  const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, MAX_SCORE - penalty));
  return { score, riskLevel: riskLevelFor(score), counts };
}
