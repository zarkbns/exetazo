import { Finding } from '../../shared/types';
import { ruleFor } from './catalog';
import { ParagraphInput } from './types';

/**
 * Cross-check contradiction detection: finds documents that assert both a
 * promise and its removal in different paragraphs. Detection is deterministic
 * pair-matching — no AI. Each check pairs an assertion with the language that
 * conflicts with it; guards keep reconciling phrasing ("except service
 * providers", trial-specific renewals) from producing false positives.
 *
 * The finding's evidence/location points at the onerous (conflicting) clause —
 * the one that wins by drafter's default — and the explanation quotes the
 * promise it contradicts.
 */

export interface ContradictionCheck {
  /** Stable pair identifier; deterministic finding IDs derive from it. */
  id: string;
  /** The promise (usually user-favorable) stated somewhere in the document. */
  assertion: RegExp;
  /** The clause that conflicts with the promise. */
  conflicting: RegExp;
  /** If the promise paragraph matches any of these, the pair is reconciled — skip. */
  assertionGuards?: RegExp[];
  /** If the conflicting clause matches any of these, it is qualified by consent or law — skip. */
  conflictingGuards?: RegExp[];
  /** Short description inserted between the two quoted assertions. */
  summary: string;
}

export const CONTRADICTION_CHECKS: readonly ContradictionCheck[] = [
  {
    id: 'cancel-anytime-vs-exclusive-method',
    assertion: /cancel[^.]{0,60}at any time/i,
    conflicting:
      /(cancellations?[^.]{0,60}(must|will only|can only)\s+be\s+(made|accepted|submitted)|to cancel[^.]{0,80}(call|write|mail|contact)( us| customer| our))/i,
    summary: 'you can cancel at any time, yet cancellation is restricted to specific channels',
  },
  {
    id: 'no-sale-vs-sale-grant',
    assertion: /\b(we|the company|the service)\s+(do(es)?\s+not|never|don'?t)\s+sell[^.]{0,60}(personal )?(information|data)/i,
    conflicting: /(may|will|can|reserve[sd]? the right to)\s+(sell|rent|monetiz\w*)[^.]{0,60}(personal )?(information|data)/i,
    assertionGuards: [
      /except|other than|aside from|as described|as set forth|as stated|as outlined/i,
      /opt[-\s]?out|click (on|here)|link (on|in)|footer|exercise your (rights|preferences)/i,
    ],
    conflictingGuards: [/with your consent|where allowed|as permitted|as required by law|when required|to the extent/i],
    summary: 'the document promises not to sell your data, but also grants itself permission to sell it',
  },
  {
    id: 'no-share-vs-share-grant',
    assertion: /\b(we|the company|the service)\s+(do(es)?\s+not|never|don'?t)\s+(share|disclose|transfer|give|provide)[^.]{0,80}(personal )?(information|data)/i,
    conflicting:
      /(may|will|can)\s+(share|disclose|transfer|provide)[^.]{0,60}(with|to)[^.]{0,40}(third part|affiliates|partners|advertisers|marketing)/i,
    assertionGuards: [
      /except|other than|aside from|as described|as set forth|as stated|as outlined|only as/i,
      /opt[-\s]?out|click (on|here)|link (on|in)|footer|exercise your (rights|preferences)/i,
    ],
    conflictingGuards: [/with your consent|where allowed|as permitted|as required by law|when required|to the extent/i],
    summary: 'the document promises not to share your data, but also permits sharing it with third parties',
  },
  {
    id: 'never-renew-vs-auto-renew',
    assertion: /(never|will not|won'?t|does not|do not)\s+(automatically\s+)?(auto[-\s]?)?renew/i,
    conflicting: /(automatic(ally)?|auto)[-]?\s?renew/i,
    assertionGuards: [/trial|promo(tion|tional)|gift|introductory/i],
    summary: 'the document says the service will not renew automatically, but also states that it will',
  },
];

const MAX_QUOTE = 160;

function quote(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > MAX_QUOTE ? `${trimmed.slice(0, MAX_QUOTE).trim()}…` : trimmed;
}

export function detectContradictions(paragraphs: readonly ParagraphInput[]): Finding[] {
  const rule = ruleFor('contradictory-clauses');
  const findings: Finding[] = [];

  for (const check of CONTRADICTION_CHECKS) {
    const assertionParagraph = paragraphs.find(
      (p) =>
        check.assertion.test(p.text) &&
        !(check.assertionGuards ?? []).some((guard) => guard.test(p.text)),
    );
    if (!assertionParagraph) continue;

    const conflictingParagraph = paragraphs.find(
      (p) =>
        check.conflicting.test(p.text) &&
        !(check.conflictingGuards ?? []).some((guard) => guard.test(p.text)),
    );
    if (!conflictingParagraph || conflictingParagraph === assertionParagraph) continue;

    const evidence = conflictingParagraph.text.trim();
    findings.push({
      id: `contradictory-clauses:${check.id}`,
      category: 'contradictory-clauses',
      severity: rule.severity,
      title: rule.title,
      evidence,
      location: {
        paragraphIndex: conflictingParagraph.index,
        ...(conflictingParagraph.section ? { section: conflictingParagraph.section } : {}),
        excerptStart: conflictingParagraph.offset,
        excerptEnd: conflictingParagraph.offset + evidence.length,
      },
      explanation: `This document states: "${quote(assertionParagraph.text)}" — but elsewhere: "${quote(evidence)}". ${check.summary.charAt(0).toUpperCase()}${check.summary.slice(1)}. ${rule.rationale}`,
      recommendation: rule.recommendation,
      confidence: rule.baseConfidence,
      source: 'rules',
      scoreAffecting: true,
    });
  }

  return findings;
}
