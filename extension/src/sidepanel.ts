import { Finding, ScanReport, Severity } from '../../shared/types';
import { LastScan } from './messages';

interface PanelElements {
  scanButton: HTMLButtonElement;
  status: HTMLElement;
  summary: HTMLElement;
  findings: HTMLElement;
}

const LEVEL_CLASS: Record<string, string> = {
  critical: 'level-critical',
  high: 'level-high',
  moderate: 'level-moderate',
  low: 'level-low',
};

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'severity-critical',
  high: 'severity-high',
  medium: 'severity-medium',
  low: 'severity-low',
};

const LEVEL_LABEL: Record<string, string> = {
  critical: 'CRITICAL RISK',
  high: 'HIGH RISK',
  moderate: 'MODERATE RISK',
  low: 'LOW RISK',
};

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing #${id}`);
  return element as T;
}

function setStatus(message: string, kind: 'info' | 'error' | 'busy' = 'info'): void {
  const status = el<HTMLDivElement>('status');
  status.classList.remove('hidden');
  status.classList.toggle('error', kind === 'error');
  status.textContent = kind === 'busy' ? `⏳ ${message}` : message;
}

function clearStatus(): void {
  el<HTMLDivElement>('status').classList.add('hidden');
}

function renderSummary(report: ScanReport, lastScan: LastScan): void {
  const summary = el<HTMLDivElement>('summary');
  summary.classList.remove('hidden');
  const level = report.riskLevel;
  summary.innerHTML = '';

  const scoreRow = document.createElement('div');
  scoreRow.className = 'score-row';
  const score = document.createElement('span');
  score.className = 'score';
  score.textContent = String(report.score);
  const total = document.createElement('span');
  total.className = 'score-total';
  total.textContent = '/ 100';
  scoreRow.append(score, total);

  const badge = document.createElement('div');
  badge.className = `level-badge ${LEVEL_CLASS[level] ?? ''}`;
  badge.textContent = LEVEL_LABEL[level] ?? level.toUpperCase();

  const counts = document.createElement('div');
  counts.className = 'counts';
  const chip = (label: string, value: number): HTMLElement => {
    const span = document.createElement('span');
    span.className = 'count-chip';
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    span.append(strong, document.createTextNode(` ${label}`));
    return span;
  };
  counts.append(
    chip('Critical', report.counts.critical),
    chip('High', report.counts.high),
    chip('Medium', report.counts.medium),
    chip('Low', report.counts.low),
  );

  const meta = document.createElement('div');
  meta.className = 'doc-meta';
  const source = lastScan.title || lastScan.url || 'this page';
  meta.textContent = `${source} · ${report.document.wordCount.toLocaleString()} words`;
  if (report.warnings.length > 0) {
    meta.textContent += ` · ${report.warnings[0]}`;
  }

  summary.append(scoreRow, badge, counts, meta);
}

function renderFinding(finding: Finding): HTMLElement {
  const details = document.createElement('details');
  details.className = 'finding';

  const summary = document.createElement('summary');
  const chip = document.createElement('span');
  chip.className = `severity-chip ${SEVERITY_CLASS[finding.severity]}`;
  const title = document.createElement('span');
  title.className = 'finding-title';
  title.textContent = finding.title;
  const section = document.createElement('span');
  section.className = 'finding-section';
  section.textContent = finding.location.section ?? '';
  summary.append(chip, title, section);

  const body = document.createElement('div');
  body.className = 'finding-body';

  const why = document.createElement('h4');
  why.textContent = 'Why this matters';
  const whyText = document.createElement('p');
  whyText.textContent = finding.explanation;

  const ev = document.createElement('h4');
  ev.textContent = 'Evidence';
  const quote = document.createElement('blockquote');
  quote.className = 'evidence';
  quote.textContent = finding.evidence;

  const rec = document.createElement('h4');
  rec.textContent = 'What to watch for';
  const recText = document.createElement('p');
  recText.textContent = finding.recommendation;

  const confidence = document.createElement('div');
  confidence.className = 'confidence';
  confidence.textContent = `Detection confidence: ${finding.confidence}%`;

  const highlight = document.createElement('button');
  highlight.className = 'highlight-button';
  highlight.type = 'button';
  highlight.textContent = 'Highlight in page';
  highlight.addEventListener('click', () => {
    highlight.disabled = true;
    chrome.runtime
      .sendMessage({ type: 'EXETAZO_HIGHLIGHT', evidence: finding.evidence })
      .then((response: { ok?: boolean; found?: boolean } | undefined) => {
        highlight.textContent = response?.found ? 'Highlighted ✓' : 'Not found on page';
      })
      .catch(() => {
        highlight.textContent = 'Highlight failed';
      })
      .finally(() => {
        setTimeout(() => {
          highlight.disabled = false;
          highlight.textContent = 'Highlight in page';
        }, 2500);
      });
  });

  body.append(why, whyText, ev, quote, rec, recText, confidence);
  if (!finding.scoreAffecting) {
    const advisory = document.createElement('div');
    advisory.className = 'advisory';
    advisory.textContent =
      'Semantic detection — shown for context only. The score counts rule-verified findings.';
    body.append(advisory);
  }
  body.append(highlight);
  details.append(summary, body);
  return details;
}

function renderFindings(report: ScanReport): void {
  const findings = el<HTMLDivElement>('findings');
  findings.innerHTML = '';

  if (report.findings.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '';
    const icon = document.createElement('div');
    icon.className = 'clean-icon';
    icon.textContent = '✓';
    const text = document.createElement('div');
    text.textContent = 'No risky clauses detected by the current rules.';
    empty.append(icon, text);
    findings.appendChild(empty);
    return;
  }

  for (const finding of report.findings) {
    findings.appendChild(renderFinding(finding));
  }
}

function render(lastScan: LastScan | null): void {
  const summary = el<HTMLDivElement>('summary');
  if (!lastScan) {
    setStatus('Open a legal page (Terms of Service, Privacy Policy…) and hit Scan.', 'info');
    summary.classList.add('hidden');
    el<HTMLDivElement>('findings').innerHTML = '';
    return;
  }
  if (lastScan.error) {
    setStatus(lastScan.error, 'error');
    summary.classList.add('hidden');
    el<HTMLDivElement>('findings').innerHTML = '';
    return;
  }
  if (!lastScan.report) return;
  clearStatus();
  renderSummary(lastScan.report, lastScan);
  renderFindings(lastScan.report);
}

async function refresh(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: 'EXETAZO_GET_LAST_SCAN' })) as {
    ok: boolean;
    lastScan: LastScan | null;
  };
  if (response?.ok) render(response.lastScan);
}

async function scan(): Promise<void> {
  const scanButton = el<HTMLButtonElement>('scan-button');
  scanButton.disabled = true;
  setStatus('Scanning — extracting text and analyzing clauses…', 'busy');
  try {
    const outcome = (await chrome.runtime.sendMessage({ type: 'EXETAZO_SCAN' })) as {
      ok: boolean;
      error?: string;
    };
    if (!outcome?.ok && outcome?.error) {
      setStatus(outcome.error, 'error');
    }
    await refresh();
  } catch (err) {
    setStatus(`Scan failed: ${String(err)}`, 'error');
  } finally {
    scanButton.disabled = false;
  }
}

el<HTMLButtonElement>('scan-button').addEventListener('click', () => void scan());
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.lastScan) render(changes.lastScan.newValue as LastScan);
});
void refresh();
