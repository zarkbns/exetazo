import { ScanReport, ScanError } from '../../shared/types';

/**
 * Extension message protocol and backend endpoint. The backend URL is the
 * only configuration the extension holds — no secrets, ever. Analysis
 * credentials live server-side only.
 */

export const API_BASE = 'http://127.0.0.1:8787';
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
  | { type: 'EXETAZO_HIGHLIGHT'; evidence: string }
  | { type: 'EXETAZO_GET_LAST_SCAN' };

export type ExetazoResponse =
  | { ok: true; lastScan: LastScan | null }
  | { ok: false; error: string; code?: string }
  | ExtractResult
  | ScanOutcome
  | { ok: boolean; found?: boolean };

export type { ScanError };
