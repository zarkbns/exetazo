import http from 'http';
import { ScanError, ScanRequest } from '../../shared/types';
import { analyzeText, NotLegalTextError } from '../analyzer/analyze';
import { MAX_RAW_CHARS } from '../analyzer/clean';
import { SemanticAnalyzer } from '../llm/types';

/**
 * HTTP API for the extension. Framework-free by design: no dependencies,
 * no hidden magic — the request contract lives in shared/types.ts and the
 * analysis pipeline is fully synchronous except for the optional AI layer.
 *
 * Error contract (ScanError):
 *   400 invalid-request  — malformed JSON or missing text field
 *   413 text-too-long    — body or text exceeds the size limit
 *   422 not-legal-text   — too little document text after cleaning
 *   504 timeout          — analysis exceeded the request budget
 *   500 server-error     — unexpected failure
 */

export const MAX_BODY_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 5000;

export class TimeoutError extends Error {
  constructor() {
    super('Analysis timed out');
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function parseScanRequest(raw: string): ScanRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { text, title, url } = parsed as Record<string, unknown>;
  if (typeof text !== 'string') return null;
  return {
    text,
    ...(typeof title === 'string' ? { title } : {}),
    ...(typeof url === 'string' ? { url } : {}),
  };
}

export function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

export function scanError(status: number, code: ScanError['code'], error: string, details?: string): ScanError {
  return { error, code, ...(details ? { details } : {}) };
}

export interface ServerOptions {
  ai?: SemanticAnalyzer | null;
  timeoutMs?: number;
}

export function createServer(options: ServerOptions = {}): http.Server {
  const { ai = null, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  return http.createServer((req, res) => {
    const method = req.method ?? '';
    const path = (req.url ?? '/').split('?')[0];

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    if (method === 'GET' && path === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method !== 'POST' || path !== '/analyze') {
      sendJson(res, 404, scanError(404, 'invalid-request', 'Not found. Use POST /analyze.'));
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let oversized = false;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        oversized = true;
        return;
      }
      chunks.push(chunk);
    });

    req.on('error', () => {
      if (!res.headersSent) sendJson(res, 400, scanError(400, 'invalid-request', 'Request stream failed.'));
    });

    req.on('end', () => {
      if (oversized) {
        sendJson(res, 413, scanError(413, 'text-too-long', 'Request body exceeds the size limit.'));
        return;
      }

      const request = parseScanRequest(Buffer.concat(chunks).toString('utf8'));
      if (!request) {
        sendJson(res, 400, scanError(400, 'invalid-request', 'Body must be JSON with a string "text" field.'));
        return;
      }
      if (request.text.length > MAX_RAW_CHARS) {
        sendJson(res, 413, scanError(413, 'text-too-long', 'Document text exceeds the size limit.'));
        return;
      }

      withTimeout(analyzeText(request, { ai }), timeoutMs)
        .then((report) => sendJson(res, 200, report))
        .catch((error: unknown) => {
          if (res.headersSent) return;
          if (error instanceof NotLegalTextError) {
            sendJson(res, 422, scanError(422, 'not-legal-text', error.message));
          } else if (error instanceof TimeoutError) {
            sendJson(res, 504, scanError(504, 'timeout', 'Analysis took too long.'));
          } else {
            sendJson(res, 500, scanError(500, 'server-error', 'Analysis failed.'));
          }
        });
    });
  });
}
