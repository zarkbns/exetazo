/**
 * Shared contracts between the Exetazo extension and the analysis backend.
 *
 * Determinism boundary: severity and score are produced by the rules engine
 * from structured findings. `confidence` is detection metadata for display
 * only and must never influence scoring.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export const RISK_CATEGORIES = [
  'unilateral-modification',
  'mandatory-arbitration',
  'class-action-waiver',
  'automatic-renewal',
  'difficult-cancellation',
  'broad-liability-limitation',
  'broad-indemnification',
  'broad-data-sharing',
  'data-sale-permission',
  'data-retention-ambiguity',
  'account-termination',
  'venue-jurisdiction',
  'hidden-fees',
  'broad-ip-ownership',
  'contradictory-clauses',
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

/** Where a finding's evidence lives in the cleaned document. */
export interface ClauseLocation {
  /** Index into the cleaned paragraph list (0-based, stable after cleaning). */
  paragraphIndex: number;
  /** Nearest section heading above the paragraph, if one exists. */
  section?: string;
  /** Character offsets of `evidence` within the full cleaned text. */
  excerptStart: number;
  excerptEnd: number;
}

export interface Finding {
  /** Deterministic ID derived from category + normalized evidence. */
  id: string;
  category: RiskCategory;
  severity: Severity;
  title: string;
  /** Exact source text this finding is backed by. Never fabricated. */
  evidence: string;
  location: ClauseLocation;
  explanation: string;
  recommendation: string;
  /** 0–100 detection confidence. Display only — never feeds the score. */
  confidence: number;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/** POST /analyze request body. Extension sends sanitized page text; server re-cleans. */
export interface ScanRequest {
  text: string;
  url?: string;
  title?: string;
}

export interface DocumentMeta {
  title?: string;
  url?: string;
  wordCount: number;
  paragraphCount: number;
}

/** POST /analyze success response. */
export interface ScanReport {
  score: number;
  riskLevel: RiskLevel;
  counts: SeverityCounts;
  findings: Finding[];
  document: DocumentMeta;
  /** True if the semantic AI layer contributed detections or explanations. */
  aiUsed: boolean;
  /** Degradation notices (AI unavailable, text truncated, etc.). */
  warnings: string[];
}

export type ScanErrorCode =
  | 'invalid-request'
  | 'text-too-long'
  | 'not-legal-text'
  | 'timeout'
  | 'server-error';

export interface ScanError {
  error: string;
  code: ScanErrorCode;
  details?: string;
}
