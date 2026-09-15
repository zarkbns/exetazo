import { RiskCategory, Severity } from '../../shared/types';

/**
 * A paragraph of cleaned document text with enough metadata to map a
 * finding back to its source. Produced by the analyzer's cleaner;
 * structurally compatible so rules never import the cleaner.
 */
export interface ParagraphInput {
  /** Paragraph text, trimmed. */
  text: string;
  /** 0-based index into the cleaned paragraph list. */
  index: number;
  /** Character offset of this paragraph within the full cleaned text. */
  offset: number;
  /** Nearest section heading above this paragraph, if any. */
  section?: string;
}

export interface RuleDefinition {
  category: RiskCategory;
  title: string;
  severity: Severity;
  /** What the clause looks like and what language triggers it. */
  definition: string;
  /** Why the clause is risky. */
  rationale: string;
  /** What a reader should watch for or do next. */
  recommendation: string;
  /** Case-insensitive patterns; a paragraph matching any one is flagged. */
  patterns: RegExp[];
  /** Paragraph-scoped suppressions for benign counterpart language. */
  negations?: RegExp[];
  /** Display-only detection confidence for pure pattern matches. */
  baseConfidence: number;
  /** Where detection logic varies by jurisdiction, note it here. */
  jurisdictionNote?: string;
}
