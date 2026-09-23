import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../server/api/server';

/**
 * Vercel health endpoint (GET /api/health) — the same check the local server
 * answers at /health. Serverless functions are mapped by file, so this lives
 * in its own file rather than inside api/analyze.ts's handler.
 *
 *   GET     /api/health  → { ok: true }
 *   OPTIONS /api/health  → 204 with CORS
 */

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed. Use GET.' });
    return;
  }

  sendJson(res, 200, { ok: true });
}
