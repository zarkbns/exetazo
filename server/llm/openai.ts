import { RISK_CATEGORIES, RiskCategory } from '../../shared/types';
import { AiCandidate, CleanedParagraphLike, SemanticAnalyzer } from './types';

/**
 * OpenAI-compatible semantic analyzer. Model, endpoint, and key come from
 * server-side env config only — nothing here runs in the extension. All
 * failures surface as thrown errors; the analyzer degrades to rules-only.
 */

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export const DEFAULT_TIMEOUT_MS = 5000;
const MAX_PARAGRAPHS_FOR_AI = 80;
const MAX_CHARS_PER_PARAGRAPH = 500;

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: env.OPENAI_MODEL ?? 'gpt-4o-mini',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

const SYSTEM_PROMPT = `You are a legal clause classifier for Exetazo. You receive numbered paragraphs from a legal agreement. For each paragraph that plainly states one of the listed risk categories, return its paragraph number and category. Respond with JSON only, shaped exactly: {"candidates":[{"paragraph":<number>,"category":"<category>"}]}. Include a candidate only when the paragraph text itself clearly matches. Never invent categories, paragraphs, or text.`;

/** Validate an LLM payload into candidates; drop anything malformed. */
export function parseAiCandidates(payload: unknown, paragraphCount: number): AiCandidate[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const raw = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(raw)) return [];

  const valid = new Set<string>();
  const candidates: AiCandidate[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { paragraph, category } = item as { paragraph?: unknown; category?: unknown };
    if (typeof paragraph !== 'number' || !Number.isInteger(paragraph)) continue;
    if (paragraph < 0 || paragraph >= paragraphCount) continue;
    if (typeof category !== 'string') continue;
    if (!(RISK_CATEGORIES as readonly string[]).includes(category)) continue;
    const key = `${category}:${paragraph}`;
    if (valid.has(key)) continue;
    valid.add(key);
    candidates.push({ paragraphIndex: paragraph, category: category as RiskCategory });
  }
  return candidates;
}

function extractJsonContent(text: string): unknown {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class OpenAiSemanticAnalyzer implements SemanticAnalyzer {
  constructor(
    private readonly config: LlmConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async detectParagraphs(paragraphs: readonly CleanedParagraphLike[]): Promise<AiCandidate[]> {
    const selected = paragraphs
      .slice(0, MAX_PARAGRAPHS_FOR_AI)
      .map((p) => ({ index: p.index, text: p.text.slice(0, MAX_CHARS_PER_PARAGRAPH) }));

    if (selected.length === 0) return [];

    const userContent = [
      `Risk categories: ${RISK_CATEGORIES.join(', ')}`,
      '',
      ...selected.map((p) => `[${p.index}] ${p.text}`),
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`LLM request failed with HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content ?? '';
      return parseAiCandidates(extractJsonContent(content), paragraphs.length);
    } finally {
      clearTimeout(timer);
    }
  }
}
