export interface CleanedParagraph {
  text: string;
  index: number;
  /** Character offset of the paragraph inside `fullText`. */
  offset: number;
  section?: string;
}

export interface CleanedDocument {
  paragraphs: CleanedParagraph[];
  fullText: string;
  wordCount: number;
  warnings: string[];
}

/** Below this, the "document" is probably a cookie banner, not an agreement. */
export const MIN_LEGAL_WORDS = 60;
export const MAX_RAW_CHARS = 400_000;
const MAX_PARAGRAPH_CHARS = 1200;
const SENTENCES_PER_CHUNK = 3;

/** Pure UI chrome that wraps real legal pages. */
const NOISE_LINE =
  /^(menu|home|sign in|sign up|login|log in|subscribe|search|share|tweet|follow us|back to top|skip to (main )?content|accept( all)?|reject( all)?|i accept|manage (cookies|preferences)|cookie (settings|preferences)|show more|show less|read more|learn more|advertisement|ad choices|all rights reserved|print|download pdf)$/i;

const COOKIE_BANNER =
  /(we|this (site|website)) (use|uses) (cookies|cookie)|cookie (policy|banner|notice|settings|preferences)|by (using|browsing|continuing to use)[^.]{0,60}(site|website|you agree)/i;

const NAV_JUNK = /^(.{0,40}\|.{0,40})+$|^[\s•·\-–—|*]+$/;
const COPYRIGHT_LINE = /^(©|&copy;|copyright|\(c\))/i;
const BULLET = /^\s*[-•*·]\s+/;

function isMostlySymbols(line: string): boolean {
  const letters = line.replace(/[^a-zA-Z]/g, '').length;
  return letters === 0 || letters / line.length < 0.4;
}

function isNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return (
    NOISE_LINE.test(trimmed) ||
    COOKIE_BANNER.test(trimmed) ||
    NAV_JUNK.test(trimmed) ||
    COPYRIGHT_LINE.test(trimmed) ||
    isMostlySymbols(trimmed)
  );
}

/** Short, unpunctuated, non-bullet line → treated as a section heading. */
function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (BULLET.test(line)) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  return trimmed.split(/\s+/).length <= 12;
}

function splitLongParagraph(text: string): string[] {
  if (text.length <= MAX_PARAGRAPH_CHARS) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|\S+$/g) ?? [text];
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_CHUNK) {
    const chunk = sentences.slice(i, i + SENTENCES_PER_CHUNK).join(' ').trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Re-clean raw page text sent by the extension: drop navigation, banners,
 * and footer chrome; group remaining lines into clause-sized paragraphs;
 * keep character offsets so findings map back to the document.
 */
export function cleanText(raw: string): CleanedDocument {
  const warnings: string[] = [];
  let input = raw ?? '';
  if (input.length > MAX_RAW_CHARS) {
    input = input.slice(0, MAX_RAW_CHARS);
    warnings.push('Input exceeded the size limit and was truncated.');
  }

  const lines = input.split(/\r?\n/);

  const blocks: { lines: string[]; section?: string }[] = [];
  let current: { lines: string[]; section?: string } | null = null;
  let section: string | undefined;

  const flush = () => {
    if (current && current.lines.length > 0) blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      flush();
      continue;
    }
    if (isNoise(line)) continue;
    if (isHeading(line)) {
      flush();
      section = line.trim();
      continue;
    }
    if (!current) current = { lines: [], section };
    current.lines.push(line.trim());
  }
  flush();

  const paragraphs: CleanedParagraph[] = [];
  let fullText = '';
  for (const block of blocks) {
    const joined = block.lines.join(' ').replace(/\s+/g, ' ').trim();
    if (!joined) continue;
    for (const text of splitLongParagraph(joined)) {
      const offset = fullText.length === 0 ? 0 : fullText.length + 2;
      if (fullText.length > 0) fullText += '\n\n';
      fullText += text;
      paragraphs.push({
        text,
        index: paragraphs.length,
        offset,
        ...(block.section ? { section: block.section } : {}),
      });
    }
  }

  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  return { paragraphs, fullText, wordCount, warnings };
}
