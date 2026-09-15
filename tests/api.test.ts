import { AddressInfo } from 'net';
import { createServer, TimeoutError } from '../server/api/server';
import { SemanticAnalyzer } from '../server/llm/types';
import { ScanError, ScanReport } from '../shared/types';

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const RISKY_DOCUMENT = [
  '14. Changes to this Agreement',
  '',
  'Cloudflare reserves the right to make modifications to this Agreement at any time. We may at our sole discretion terminate your user account at any time, with or without notice for any reason or no reason at all. All of your subscriptions to Paid Services with a Subscription Term will automatically renew for periods equal to your initial Subscription Term.',
  '',
  '17. Dispute Resolution and Arbitration',
  '',
  'You and Cloudflare agree that any and all disputes arising in connection with this Agreement will be resolved by binding arbitration.',
].join('\n');

const SHORT_TEXT = 'Sign in | Accept all cookies | Home';

async function listen(ai: SemanticAnalyzer | null = null, timeoutMs = 5000) {
  const server = createServer({ ai, timeoutMs });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return { server, base };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function slowAi(ms: number): SemanticAnalyzer {
  return { detectParagraphs: async () => { await sleep(ms); return []; } };
}

describe('POST /analyze', () => {
  it('returns a deterministic report for a risky agreement', async () => {
    const { server, base } = await listen();
    try {
      const response = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: RISKY_DOCUMENT, url: 'https://example.test/terms' }),
      });
      expect(response.status).toBe(200);
      const report = await json<ScanReport>(response);

      expect(report.score).toBe(50);
      expect(report.riskLevel).toBe('high');
      expect(report.counts).toEqual({ critical: 2, high: 0, medium: 2, low: 0 });
      expect(report.document.url).toBe('https://example.test/terms');
      expect(report.aiUsed).toBe(false);

      const second = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: RISKY_DOCUMENT, url: 'https://example.test/terms' }),
      });
      expect(await json<ScanReport>(second)).toEqual(report);
    } finally {
      server.close();
    }
  });

  it('rejects non-legal text with 422 not-legal-text', async () => {
    const { server, base } = await listen();
    try {
      const response = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: SHORT_TEXT }),
      });
      expect(response.status).toBe(422);
      const error = await json<ScanError>(response);
      expect(error.code).toBe('not-legal-text');
    } finally {
      server.close();
    }
  });

  it('rejects malformed JSON with 400 invalid-request', async () => {
    const { server, base } = await listen();
    try {
      const response = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      });
      expect(response.status).toBe(400);
      expect((await json<ScanError>(response)).code).toBe('invalid-request');
    } finally {
      server.close();
    }
  });

  it('rejects a body without a string text field', async () => {
    const { server, base } = await listen();
    try {
      const response = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'no text here' }),
      });
      expect(response.status).toBe(400);
      expect((await json<ScanError>(response)).code).toBe('invalid-request');
    } finally {
      server.close();
    }
  });

  it('rejects oversized bodies with 413 text-too-long', async () => {
    const { server, base } = await listen();
    try {
      const response = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x'.repeat(2_500_000) }),
      });
      expect(response.status).toBe(413);
      expect((await json<ScanError>(response)).code).toBe('text-too-long');
    } finally {
      server.close();
    }
  });

  it('answers 504 timeout when analysis exceeds the request budget', async () => {
    const { server, base } = await listen(slowAi(500), 50);
    try {
      const response = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: RISKY_DOCUMENT }),
      });
      expect(response.status).toBe(504);
      expect((await json<ScanError>(response)).code).toBe('timeout');
    } finally {
      server.close();
    }
  });

  it('degrades gracefully to rules-only when the AI layer fails', async () => {
    const failingAi: SemanticAnalyzer = {
      detectParagraphs: async () => { throw new Error('LLM down'); },
    };
    const { server, base } = await listen(failingAi);
    try {
      const response = await fetch(`${base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: RISKY_DOCUMENT }),
      });
      expect(response.status).toBe(200);
      const report = await json<ScanReport>(response);
      expect(report.aiUsed).toBe(false);
      expect(report.warnings).toContain('Semantic analysis unavailable — pattern rules only.');
      expect(report.score).toBe(50);
    } finally {
      server.close();
    }
  });
});

describe('API plumbing', () => {
  it('answers health checks', async () => {
    const { server, base } = await listen();
    try {
      const response = await fetch(`${base}/health`);
      expect(response.status).toBe(200);
      expect(await json<{ ok: boolean }>(response)).toEqual({ ok: true });
    } finally {
      server.close();
    }
  });

  it('handles CORS preflight and 404s unknown routes', async () => {
    const { server, base } = await listen();
    try {
      const preflight = await fetch(`${base}/analyze`, { method: 'OPTIONS' });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe('*');

      const unknown = await fetch(`${base}/nope`, { method: 'POST' });
      expect(unknown.status).toBe(404);
      expect((await json<ScanError>(unknown)).code).toBe('invalid-request');
    } finally {
      server.close();
    }
  });

  it('exposes TimeoutError for direct consumers', () => {
    expect(new TimeoutError().name).toBe('TimeoutError');
  });
});
