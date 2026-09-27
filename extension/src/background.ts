import { ScanError, ScanReport } from '../../shared/types';
import { ANALYZE_TIMEOUT_MS, API_BASE, ExtractResult, LastScan, ScanOutcome } from './messages';

/**
 * Service worker: orchestrates scans. Injection happens on demand (activeTab),
 * the extracted text goes straight to the backend for analysis, and the
 * resulting report is kept in session storage for the side panel. Nothing is
 * persisted beyond the session and nothing is stored server-side.
 */

async function analyzeDocument(extract: ExtractResult): Promise<ScanOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: extract.text, title: extract.title, url: extract.url }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const report = (await response.json()) as ScanReport;
      return { ok: true, report };
    }
    const error = (await response.json().catch(() => null)) as ScanError | null;
    return {
      ok: false,
      error: error?.error ?? `Analysis failed with HTTP ${response.status}`,
      code: error?.code ?? 'server-error',
    };
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      error: aborted
        ? 'Analysis took too long.'
        : 'Could not reach the Exetazo backend. Is it running on ' + API_BASE + '?',
      code: aborted ? 'timeout' : 'unreachable',
    };
  }
}

async function scanActiveTab(): Promise<ScanOutcome & { lastScan?: LastScan }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: 'No active tab to scan.' };
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['contentScript.js'] });
  } catch {
    return {
      ok: false,
      error: 'Exetazo cannot scan this page (restricted or unsupported page).',
      code: 'invalid-request',
    };
  }

  const extract = (await chrome.tabs.sendMessage(tab.id, { type: 'EXETAZO_EXTRACT' })) as
    | ExtractResult
    | undefined;
  if (!extract?.ok || !extract.text || extract.text.trim().length === 0) {
    const lastScan: LastScan = {
      tabId: tab.id,
      scannedAt: Date.now(),
      error: 'Could not extract text from this page.',
      code: 'not-legal-text',
    };
    await chrome.storage.session.set({ lastScan });
    return { ok: false, ...lastScan, lastScan };
  }

  const outcome = await analyzeDocument(extract);
  const lastScan: LastScan = {
    tabId: tab.id,
    scannedAt: Date.now(),
    url: extract.url,
    title: extract.title,
    ...(outcome.ok ? { report: outcome.report } : { error: outcome.error, code: outcome.code }),
  };
  await chrome.storage.session.set({ lastScan });
  return { ...outcome, lastScan };
}

async function highlightInActiveTab(
  evidence: string,
  section?: string,
): Promise<{ ok: boolean; found?: boolean }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false };
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXETAZO_HIGHLIGHT',
      evidence,
      ...(section ? { section } : {}),
    });
    return { ok: true, found: Boolean(response?.found) };
  } catch {
    return { ok: false, found: false };
  }
}

/**
 * Firefox closes a message channel as soon as the listener returns and
 * delivers the listener's returned Promise as the response; the Chrome
 * convention — return true, then call sendResponse later — is ignored there,
 * so every async reply used to arrive as undefined and the scan died silently
 * in the UI. The `browser` global exists only in Firefox, so the response
 * contract is detected once and each async handler is delivered through the
 * contract the running browser implements. Payloads are identical either way.
 */
const FIREFOX_PROMISE_RESPONSES =
  typeof (globalThis as { browser?: unknown }).browser === 'object';

function deliverAsync<T>(
  work: Promise<T>,
  sendResponse: (value: T) => void,
): boolean | Promise<T> {
  if (FIREFOX_PROMISE_RESPONSES) return work;
  void work.then(sendResponse);
  return true;
}

chrome.runtime.onMessage.addListener(
  (message: { type?: string; evidence?: string; section?: string }, _sender, sendResponse) => {
    if (message?.type === 'EXETAZO_SCAN') {
      return deliverAsync(
        scanActiveTab().catch((err: unknown): ScanOutcome => ({ ok: false, error: String(err) })),
        sendResponse,
      );
    }
    if (message?.type === 'EXETAZO_HIGHLIGHT') {
      return deliverAsync(
        highlightInActiveTab(message.evidence ?? '', message.section).catch(
          () => ({ ok: false, found: false }),
        ),
        sendResponse,
      );
    }
    if (message?.type === 'EXETAZO_GET_LAST_SCAN') {
      return deliverAsync(
        chrome.storage.session
          .get('lastScan')
          .then((data) => ({ ok: true, lastScan: (data.lastScan as LastScan) ?? null }))
          .catch(() => ({ ok: false, error: 'Storage unavailable' })),
        sendResponse,
      );
    }
    return undefined;
  },
);
