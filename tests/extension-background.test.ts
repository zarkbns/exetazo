/**
 * The background's async message replies must satisfy two different
 * WebExtension response contracts: Chrome holds the channel open when the
 * listener returns true and delivers only through sendResponse; Firefox
 * ignores the `true` convention, closes the channel when the listener
 * returns, and delivers the returned Promise's resolution as the response.
 * Under Firefox the old Chrome-style listener made every reply resolve to
 * undefined, so a scan never reached the UI — these tests pin both contracts
 * and the full scan flow end to end.
 */

type ScanMessage = { type?: string; evidence?: string; section?: string };

type Listener = (
  message: ScanMessage,
  sender: unknown,
  sendResponse: (value?: unknown) => void,
) => unknown;

interface Background {
  listener: Listener;
  chrome: {
    runtime: { onMessage: { addListener: jest.Mock } };
    tabs: { query: jest.Mock; sendMessage: jest.Mock };
    scripting: { executeScript: jest.Mock };
    storage: { session: { get: jest.Mock; set: jest.Mock } };
  };
}

function loadBackground(firefox: boolean): Background {
  jest.resetModules();
  const chrome = {
    runtime: { onMessage: { addListener: jest.fn() } },
    tabs: { query: jest.fn(), sendMessage: jest.fn() },
    scripting: { executeScript: jest.fn() },
    storage: { session: { get: jest.fn(), set: jest.fn() } },
  };
  (globalThis as Record<string, unknown>).chrome = chrome;
  if (firefox) {
    (globalThis as Record<string, unknown>).browser = {};
  } else {
    delete (globalThis as Record<string, unknown>).browser;
  }
  require('../extension/src/background');
  const listener = chrome.runtime.onMessage.addListener.mock.calls[0][0] as Listener;
  return { listener, chrome };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterAll(() => {
  delete (globalThis as Record<string, unknown>).chrome;
  delete (globalThis as Record<string, unknown>).browser;
  delete (globalThis as Record<string, unknown>).fetch;
});

describe('background message responses across browser contracts', () => {
  it('Firefox: a GET_LAST_SCAN reply is the listener promise, sendResponse untouched', async () => {
    const { listener, chrome } = loadBackground(true);
    const stored = { tabId: 7, scannedAt: 1, url: 'https://example.test/terms' };
    chrome.storage.session.get.mockResolvedValue({ lastScan: stored });

    const sendResponse = jest.fn();
    const result = listener({ type: 'EXETAZO_GET_LAST_SCAN' }, {}, sendResponse);

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual({ ok: true, lastScan: stored });
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('Chrome: the same reply returns true and arrives through sendResponse', async () => {
    const { listener, chrome } = loadBackground(false);
    chrome.storage.session.get.mockResolvedValue({ lastScan: null });

    const sendResponse = jest.fn();
    const result = listener({ type: 'EXETAZO_GET_LAST_SCAN' }, {}, sendResponse);

    expect(result).toBe(true);
    await flushMicrotasks();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, lastScan: null });
  });

  it('Firefox: a storage failure still resolves to a ScanError reply', async () => {
    const { listener, chrome } = loadBackground(true);
    chrome.storage.session.get.mockRejectedValue(new Error('storage gone'));

    const result = await listener({ type: 'EXETAZO_GET_LAST_SCAN' }, {}, jest.fn());
    expect(result).toEqual({ ok: false, error: 'Storage unavailable' });
  });

  it('Firefox: the full scan flow — inject, extract, POST /analyze, session storage', async () => {
    const { listener, chrome } = loadBackground(true);
    chrome.tabs.query.mockResolvedValue([{ id: 7 }]);
    chrome.scripting.executeScript.mockResolvedValue(undefined);
    chrome.tabs.sendMessage.mockImplementation(
      async (_tabId: number, message: ScanMessage): Promise<unknown> => {
        if (message?.type === 'EXETAZO_EXTRACT') {
          return { ok: true, text: 'governing law text', title: 'Terms', url: 'https://example.test/terms' };
        }
        return undefined;
      },
    );
    chrome.storage.session.set.mockResolvedValue(undefined);
    const report = { score: 42, riskLevel: 'moderate', findings: [], counts: {}, warnings: [], document: { wordCount: 3, title: 'Terms' } };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => report });
    (globalThis as Record<string, unknown>).fetch = fetchMock;

    const sendResponse = jest.fn();
    const outcome = (await listener({ type: 'EXETAZO_SCAN' }, {}, sendResponse)) as {
      ok: boolean;
    };

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['contentScript.js'],
    });
    const [url, init] = fetchMock.mock.calls[0] as [unknown, { method: string; body: string }];
    expect(String(url)).toContain('/analyze');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).text).toBe('governing law text');
    expect(outcome.ok).toBe(true);
    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      lastScan: expect.objectContaining({ tabId: 7, url: 'https://example.test/terms', report }),
    });
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('Chrome: the same scan keeps the channel open and replies through sendResponse', async () => {
    const { listener, chrome } = loadBackground(false);
    chrome.tabs.query.mockResolvedValue([{ id: 9 }]);
    chrome.scripting.executeScript.mockResolvedValue(undefined);
    chrome.tabs.sendMessage.mockImplementation(
      async (_tabId: number, message: ScanMessage): Promise<unknown> => {
        if (message?.type === 'EXETAZO_EXTRACT') {
          return { ok: true, text: 'governing law text', title: 'Terms', url: 'https://example.test/terms' };
        }
        return undefined;
      },
    );
    chrome.storage.session.set.mockResolvedValue(undefined);
    const report = { score: 42, riskLevel: 'moderate', findings: [], counts: {}, warnings: [], document: { wordCount: 3, title: 'Terms' } };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => report });
    (globalThis as Record<string, unknown>).fetch = fetchMock;

    const sendResponse = jest.fn();
    const result = listener({ type: 'EXETAZO_SCAN' }, {}, sendResponse);

    expect(result).toBe(true);
    await flushMicrotasks();
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true, report }));
  });

  it('Firefox: an API failure resolves to an error outcome, not a rejection', async () => {
    const { listener, chrome } = loadBackground(true);
    chrome.tabs.query.mockResolvedValue([{ id: 7 }]);
    chrome.scripting.executeScript.mockResolvedValue(undefined);
    chrome.tabs.sendMessage.mockResolvedValue({
      ok: true,
      text: 'governing law text',
      title: 'Terms',
      url: 'https://example.test/terms',
    });
    chrome.storage.session.set.mockResolvedValue(undefined);
    (globalThis as Record<string, unknown>).fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('NetworkError'));

    const outcome = (await listener({ type: 'EXETAZO_SCAN' }, {}, jest.fn())) as {
      ok: boolean;
      code?: string;
    };

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe('unreachable');
  });
});
