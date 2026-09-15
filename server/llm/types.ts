import { RiskCategory } from '../../shared/types';

/** A semantic detection candidate: which paragraph states which category. */
export interface AiCandidate {
  paragraphIndex: number;
  category: RiskCategory;
}

/**
 * Swappable semantic analysis layer. Implementations may call an LLM; the
 * rules engine and scoring never depend on one. Evidence integrity is
 * enforced upstream: candidates reference paragraph indices, and the
 * analyzer builds evidence from the cleaned text itself — never from
 * AI-provided strings.
 */
export interface SemanticAnalyzer {
  detectParagraphs(
    paragraphs: ReadonlyArray<Pick<CleanedParagraphLike, 'text' | 'index'>>,
  ): Promise<AiCandidate[]>;
}

export interface CleanedParagraphLike {
  text: string;
  index: number;
}
