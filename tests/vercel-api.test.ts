import { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import handler from '../api/analyze';
import { MAX_RAW_CHARS } from '../server/analyzer/clean';

interface Captured {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function makeRes(): { res: ServerResponse; captured: Captured } {
  const captured: Captured = { status: 0, headers: {}, body: '' };
  const res = {
    headersSent: false,
    writeHead(this: { headersSent: boolean }, status: number, headers?: Record<string, string>) {
      captured.status = status;
      if (headers) captured.headers = headers;
      this.headersSent = true;
      return this;
    },
    end(chunk?: string) {
      if (chunk) captured.body += chunk;
    },
  } as unknown as ServerResponse;
  return { res, captured };
}

function makeReq(method: string, url: string, body?: string): IncomingMessage {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(body, 'utf8')]);
  return Object.assign(stream, { method, url }) as unknown as IncomingMessage;
}

/** A short but complete document: >60 words, with two clearly risky clauses. */
const TERMS = [
  'These Terms of Service govern your access to and use of the Service, and by creating an account you accept them in full.',
  'You agree that any dispute arising out of or relating to these Terms or the Service shall be finally resolved by binding arbitration rather than in court, and you waive your right to a trial by jury.',
  'We reserve the right to modify these Terms at any time and without prior notice, and continued use of the Service after a change means you accept the revised Terms.',
  'The Service is provided on an as-is basis, and we may suspend or terminate your account at any time, for any reason, with or without notice.',
].join('\n\n');

async function post(body: string, url = '/api/analyze') {
  const { res, captured } = makeRes();
  await handler(makeReq('POST', url, body), res);
  return captured;
}

describe('Vercel serverless endpoint', () => {
  it('analyzes a document and returns a deterministic report', async () => {
    const first = await post(JSON.stringify({ text: TERMS, title: 'Sample Terms', url: 'https://example.test/terms' }));
    expect(first.status).toBe(200);

    const report = JSON.parse(first.body);
    expect(report.score).toBeLessThan(100);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.aiUsed).toBe(false);
    expect(report.document.title).toBe('Sample Terms');
    expect(report.findings.map((f: { category: string }) => f.category)).toContain('mandatory-arbitration');
    for (const finding of report.findings) {
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(finding.location.paragraphIndex).toBeGreaterThanOrEqual(0);
    }

    const second = await post(JSON.stringify({ text: TERMS, title: 'Sample Terms', url: 'https://example.test/terms' }));
    expect(second.body).toBe(first.body);
  });

  it('accepts the bare /analyze path too', async () => {
    const captured = await post(JSON.stringify({ text: TERMS }), '/analyze');
    expect(captured.status).toBe(200);
  });

  it('sends permissive CORS headers so the extension can call it', async () => {
    const captured = await post(JSON.stringify({ text: TERMS }));
    expect(captured.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(captured.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
  });

  it('answers CORS preflight with 204', async () => {
    const { res, captured } = makeRes();
    await handler(makeReq('OPTIONS', '/api/analyze'), res);
    expect(captured.status).toBe(204);
    expect(captured.headers['Access-Control-Allow-Methods']).toContain('POST');
  });

  it('exposes a health check', async () => {
    const { res, captured } = makeRes();
    await handler(makeReq('GET', '/api/health'), res);
    expect(captured.status).toBe(200);
    expect(JSON.parse(captured.body)).toEqual({ ok: true });
  });

  it('rejects malformed JSON with 400', async () => {
    const captured = await post('this is not json');
    expect(captured.status).toBe(400);
    expect(JSON.parse(captured.body).code).toBe('invalid-request');
  });

  it('rejects a body without a text field with 400', async () => {
    const captured = await post(JSON.stringify({ title: 'no text here' }));
    expect(captured.status).toBe(400);
    expect(JSON.parse(captured.body).code).toBe('invalid-request');
  });

  it('rejects documents that are not legal text with 422', async () => {
    const captured = await post(JSON.stringify({ text: 'Hello there.' }));
    expect(captured.status).toBe(422);
    expect(JSON.parse(captured.body).code).toBe('not-legal-text');
  });

  it('rejects oversized documents with 413', async () => {
    const captured = await post(JSON.stringify({ text: 'a '.repeat(MAX_RAW_CHARS) }));
    expect(captured.status).toBe(413);
    expect(JSON.parse(captured.body).code).toBe('text-too-long');
  });

  it('returns 404 for unsupported methods and paths', async () => {
    const { res, captured } = makeRes();
    await handler(makeReq('GET', '/api/analyze'), res);
    expect(captured.status).toBe(404);

    const other = makeRes();
    await handler(makeReq('POST', '/api/something-else', '{}'), other.res);
    expect(other.captured.status).toBe(404);
  });
});
