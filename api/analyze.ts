import type { IncomingMessage, ServerResponse } from 'http';
import { analyzeText, NotLegalTextError } from '../server/analyzer/analyze';
import { MAX_RAW_CHARS } from '../server/analyzer/clean';
import {
  MAX_BODY_BYTES,
  parseScanRequest,
  scanError,
  sendJson,
  TimeoutError,
  withTimeout,
} from '../server/api/server';

/**
 * Vercel serverless entry point — the same analysis pipeline as the local API,
 * so the extension can point at either one unchanged.
 *
 * Rules-only by design: the deployment holds no credentials, and the score is
 * pure rule arithmetic, so every scan of a document returns the same result.
 *
 * Routes (Vercel maps this file to /api/analyze):
 *   OPTIONS /api/analyze  → 204 with CORS
 *   GET     /api/health   → { ok: true }
 *   POST    /api/analyze  → ScanReport, or a ScanError with the codes below
 */

const ANALYZE_TIMEOUT_MS = 5000;

interface FunctionRequest extends IncomingMessage {
  /** Vercel parses JSON bodies for Node functions; fall back to the stream. */
  body?: unknown;
}

async function readRawBody(req: FunctionRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLargeError();
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

class BodyTooLargeError extends Error {}

export default async function handler(req: FunctionRequest, res: ServerResponse): Promise<void> {
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

  if (method === 'GET' && (path === '/health' || path === '/api/health')) {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method !== 'POST' || (path !== '/analyze' && path !== '/api/analyze')) {
    sendJson(res, 404, scanError(404, 'invalid-request', 'Not found. Use POST /analyze.'));
    return;
  }

  try {
    const raw = await readRawBody(req);
    const request = parseScanRequest(raw);
    if (!request) {
      sendJson(res, 400, scanError(400, 'invalid-request', 'Body must be JSON with a string "text" field.'));
      return;
    }
    if (request.text.length > MAX_RAW_CHARS) {
      sendJson(res, 413, scanError(413, 'text-too-long', 'Document text exceeds the size limit.'));
      return;
    }

    const report = await withTimeout(analyzeText(request), ANALYZE_TIMEOUT_MS);
    sendJson(res, 200, report);
  } catch (error: unknown) {
    if (res.headersSent) return;
    if (error instanceof BodyTooLargeError) {
      sendJson(res, 413, scanError(413, 'text-too-long', 'Request body exceeds the size limit.'));
    } else if (error instanceof NotLegalTextError) {
      sendJson(res, 422, scanError(422, 'not-legal-text', error.message));
    } else if (error instanceof TimeoutError) {
      sendJson(res, 504, scanError(504, 'timeout', 'Analysis took too long.'));
    } else {
      sendJson(res, 500, scanError(500, 'server-error', 'Analysis failed.'));
    }
  }
}
