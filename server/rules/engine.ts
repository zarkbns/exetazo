import { createHash } from 'crypto';
import { Finding, RiskCategory } from '../../shared/types';
import { RULES } from './catalog';
import { ParagraphInput, RuleDefinition } from './types';

/**
 * Synchronous, deterministic rules engine. No async calls, no LLM in this
 * path: the same paragraphs always produce the same findings in the same
 * order.
 */

const DEFAULT_ONE_PER_CATEGORY = true;

/** Findings per category per unique evidence — repeated clauses of the same
 * type are one underlying issue and must not double-count. */
export function findingId(category: RiskCategory, evidence: string): string {
  const normalized = evidence.toLowerCase().replace(/\s+/g, ' ').trim();
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 12);
  return `${category}:${hash}`;
}

function toFinding(rule: RuleDefinition, paragraph: ParagraphInput): Finding {
  const evidence = paragraph.text.trim();
  return {
    id: findingId(rule.category, evidence),
    category: rule.category,
    severity: rule.severity,
    title: rule.title,
    evidence,
    location: {
      paragraphIndex: paragraph.index,
      section: paragraph.section,
      excerptStart: paragraph.offset,
      excerptEnd: paragraph.offset + evidence.length,
    },
    explanation: rule.rationale,
    recommendation: rule.recommendation,
    confidence: rule.baseConfidence,
  };
}

export interface EvaluateOptions {
  /** Emit at most one finding per category (default true, so the same
   * underlying issue stated twice cannot compound the penalty). */
  onePerCategory?: boolean;
}

export function evaluateRules(
  paragraphs: readonly ParagraphInput[],
  options: EvaluateOptions = {},
): Finding[] {
  const onePerCategory = options.onePerCategory ?? DEFAULT_ONE_PER_CATEGORY;
  const findings: Finding[] = [];
  const seenIds = new Set<string>();
  const flaggedCategories = new Set<RiskCategory>();

  for (const rule of RULES) {
    for (const paragraph of paragraphs) {
      if (onePerCategory && flaggedCategories.has(rule.category)) continue;
      if (rule.negations?.some((negation) => negation.test(paragraph.text))) continue;
      if (!rule.patterns.some((pattern) => pattern.test(paragraph.text))) continue;

      const finding = toFinding(rule, paragraph);
      if (seenIds.has(finding.id)) continue;
      seenIds.add(finding.id);
      flaggedCategories.add(rule.category);
      findings.push(finding);
    }
  }

  return findings;
}
