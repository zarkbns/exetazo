import { Finding, RiskCategory, RISK_CATEGORIES, ScanReport, ScanRequest, Severity } from '../../shared/types';
import { cleanText, MIN_LEGAL_WORDS } from './clean';
import { evaluateRules, findingId } from '../rules/engine';
import { ruleFor } from '../rules/catalog';
import { scoreFindings } from '../scoring/score';
import { SemanticAnalyzer, AiCandidate } from '../llm/types';

/**
 * Analysis pipeline. Rules and scoring are synchronous and deterministic;
 * the semantic layer only proposes candidates, which are validated against
 * the cleaned text (evidence is always built from real document text) and
 * merged under rules-engine constraints (one finding per category, dedupe
 * by normalized evidence).
 */

export class NotLegalTextError extends Error {
  constructor() {
    super('Could not extract legal text — the page contains too little document text.');
    this.name = 'NotLegalTextError';
  }
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const CATEGORY_RANK: Record<RiskCategory, number> = Object.fromEntries(
  RISK_CATEGORIES.map((category, i) => [category, i]),
) as Record<RiskCategory, number>;

/** AI-only detections display lower confidence; severity still comes from the rule. */
const AI_ONLY_CONFIDENCE = 55;

export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.location.paragraphIndex - b.location.paragraphIndex ||
      CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
      a.id.localeCompare(b.id),
  );
}

export interface AnalyzeOptions {
  ai?: SemanticAnalyzer | null;
}

export async function analyzeText(request: ScanRequest, options: AnalyzeOptions = {}): Promise<ScanReport> {
  const cleaned = cleanText(request.text ?? '');
  if (cleaned.wordCount < MIN_LEGAL_WORDS) {
    throw new NotLegalTextError();
  }

  const warnings = [...cleaned.warnings];
  const ruleFindings = evaluateRules(cleaned.paragraphs);
  const allFindings: Finding[] = [...ruleFindings];

  let aiUsed = false;
  if (options.ai) {
    try {
      const candidates = await options.ai.detectParagraphs(cleaned.paragraphs);
      const merged = mergeAiCandidates(candidates, ruleFindings, cleaned.paragraphs);
      allFindings.push(...merged);
      aiUsed = merged.length > 0;
    } catch {
      warnings.push('Semantic analysis unavailable — pattern rules only.');
    }
  }

  const findings = sortFindings(allFindings);
  const { score, riskLevel, counts } = scoreFindings(findings);

  return {
    score,
    riskLevel,
    counts,
    findings,
    document: {
      ...(request.title ? { title: request.title } : {}),
      ...(request.url ? { url: request.url } : {}),
      wordCount: cleaned.wordCount,
      paragraphCount: cleaned.paragraphs.length,
    },
    aiUsed,
    warnings,
  };
}

function mergeAiCandidates(
  candidates: readonly AiCandidate[],
  ruleFindings: readonly Finding[],
  paragraphs: ReadonlyArray<{ text: string; index: number; offset: number; section?: string }>,
): Finding[] {
  const flaggedCategories = new Set(ruleFindings.map((f) => f.category));
  const seenIds = new Set(ruleFindings.map((f) => f.id));
  const merged: Finding[] = [];

  for (const candidate of candidates) {
    const paragraph = paragraphs[candidate.paragraphIndex];
    if (!paragraph) continue;
    if (flaggedCategories.has(candidate.category)) continue;

    const rule = ruleFor(candidate.category);
    const evidence = paragraph.text.trim();
    const id = findingId(rule.category, evidence);
    if (seenIds.has(id)) continue;

    flaggedCategories.add(rule.category);
    seenIds.add(id);
    merged.push({
      id,
      category: rule.category,
      severity: rule.severity,
      title: rule.title,
      evidence,
      location: {
        paragraphIndex: paragraph.index,
        ...(paragraph.section ? { section: paragraph.section } : {}),
        excerptStart: paragraph.offset,
        excerptEnd: paragraph.offset + evidence.length,
      },
      explanation: rule.rationale,
      recommendation: rule.recommendation,
      confidence: AI_ONLY_CONFIDENCE,
    });
  }

  return merged;
}
