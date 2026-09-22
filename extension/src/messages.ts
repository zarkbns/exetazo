import { ScanReport, ScanError } from '../../shared/types';

/**
 * Extension message protocol and backend endpoint.
 *
 * The API origin is injected at build time from EXETAZO_API_ORIGIN
 * (see extension/webpack.config.cjs and .env.example); unset, it points at the
 * local development server. It is configuration, not a secret: the extension
 * holds no credentials, and analysis secrets live server-side only.
 */

declare const __EXETAZO_API_BASE__: string;

export const API_BASE =
  typeof __EXETAZO_API_BASE__ === 'string' ? __EXETAZO_API_BASE__ : 'http://127.0.0.1:8787';
export const ANALYZE_TIMEOUT_MS = 20_000;

export interface ExtractResult {
  ok: boolean;
  text: string;
  title: string;
  url: string;
}

export interface ScanOutcome {
  ok: boolean;
  report?: ScanReport;
  error?: string;
  code?: string;
}

export interface LastScan {
  tabId: number;
  scannedAt: number;
  url?: string;
  title?: string;
  report?: ScanReport;
  error?: string;
  code?: string;
}

export type ExetazoMessage =
  | { type: 'EXETAZO_SCAN' }
  | { type: 'EXETAZO_EXTRACT' }
  | { type: 'EXETAZO_HIGHLIGHT'; evidence: string; section?: string }
  | { type: 'EXETAZO_GET_LAST_SCAN' };

export type ExetazoResponse =
  | { ok: true; lastScan: LastScan | null }
  | { ok: false; error: string; code?: string }
  | ExtractResult
  | ScanOutcome
  | { ok: boolean; found?: boolean };

export type { ScanError };
