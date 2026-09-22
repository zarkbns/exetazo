/**
 * @jest-environment jsdom
 *
 * The side panel renders everything a backend returns: finding titles,
 * evidence quotes, explanations. This file pins the rule that none of it may
 * become markup — the report is rendered with textContent only, so a hostile
 * page or a compromised backend cannot inject elements into the panel.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Finding, ScanReport } from '../shared/types';

type SessionListener = (changes: Record<string, { newValue: unknown }>) => void;
const sessionListeners: SessionListener[] = [];

(globalThis as { chrome?: unknown }).chrome = {
  runtime: { sendMessage: async () => ({ ok: true, lastScan: null }) },
  storage: {
    session: { onChanged: { addListener: (listener: SessionListener) => sessionListeners.push(listener) } },
  },
};

const shell = readFileSync(join(__dirname, '..', 'extension', 'sidepanel.html'), 'utf8');
const body = shell.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
document.body.innerHTML = body;

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('../extension/src/sidepanel');

function emitLastScan(value: unknown): void {
  for (const listener of sessionListeners) listener({ lastScan: { newValue: value } });
}

function findingsHost(): HTMLElement {
  const host = document.getElementById('findings');
  if (!host) throw new Error('side panel markup missing #findings');
  return host;
}

const HOSTILE_RULES: Finding = {
  id: 'hostile-rules',
  category: 'mandatory-arbitration',
  severity: 'critical',
  title: '<img src=x onerror="window.__pwned=1">Mandatory Arbitration',
  evidence: '<script>window.__pwned=2</script>You waive your right to sue in court.',
  location: { paragraphIndex: 0, section: '9. Disputes', excerptStart: 0, excerptEnd: 48 },
  explanation: '<b>bold</b> explanation text',
  recommendation: '<i>italic</i> recommendation text',
  confidence: 85,
  source: 'rules',
  scoreAffecting: true,
};

const HOSTILE_AI: Finding = {
  ...HOSTILE_RULES,
  id: 'hostile-ai',
  category: 'broad-data-sharing',
  severity: 'high',
  title: 'Broad Data Sharing',
  evidence: 'We may share your data with partners.',
  confidence: 55,
  source: 'ai',
  scoreAffecting: false,
};

const REPORT: ScanReport = {
  score: 70,
  riskLevel: 'moderate',
  counts: { critical: 1, high: 0, medium: 0, low: 0 },
  findings: [HOSTILE_RULES, HOSTILE_AI],
  document: { title: 'Hostile Terms', url: 'https://example.test/terms', wordCount: 1500, paragraphCount: 12 },
  aiUsed: true,
  warnings: [],
};

describe('side panel rendering of untrusted report content', () => {
  beforeEach(() => {
    emitLastScan(null);
    emitLastScan({ tabId: 1, scannedAt: 1, report: REPORT });
  });

  it('renders hostile strings as text — no element injection anywhere', () => {
    // Scoped to the report container: the panel shell legitimately contains its
    // own brand logo and controller script tag.
    expect(findingsHost().querySelectorAll('img, script, b, i')).toHaveLength(0);
    expect((globalThis as { __pwned?: number }).__pwned).toBeUndefined();

    const text = findingsHost().textContent ?? '';
    expect(text).toContain('<img src=x onerror="window.__pwned=1">Mandatory Arbitration');
    expect(text).toContain('<script>window.__pwned=2</script>You waive your right to sue');
    expect(text).toContain('<b>bold</b> explanation text');
  });

  it('labels semantic findings as advisory and rules findings as scored', () => {
    const text = findingsHost().textContent ?? '';
    expect(text).toContain('Semantic detection — shown for context only');
    const advisories = document.querySelectorAll('.advisory');
    expect(advisories).toHaveLength(1);
  });

  it('renders the deterministic summary', () => {
    const summary = document.getElementById('summary');
    expect(summary?.textContent).toContain('70');
    expect(summary?.textContent).toContain('MODERATE RISK');
    expect(summary?.textContent).toContain('1 Critical');
  });

  it('shows the clear no-analysis state instead of findings when the page is not legal text', () => {
    emitLastScan({
      tabId: 1,
      scannedAt: 2,
      error: 'Could not extract legal text — the page contains too little document text.',
      code: 'not-legal-text',
    });
    const status = document.getElementById('status');
    expect(status?.textContent).toContain('Could not extract legal text');
    expect(status?.classList.contains('hidden')).toBe(false);
    expect(findingsHost().querySelectorAll('.finding')).toHaveLength(0);
  });
});
