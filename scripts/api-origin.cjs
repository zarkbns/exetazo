/**
 * Single source of truth for the extension's backend origin, resolved at build
 * time from EXETAZO_API_ORIGIN (see .env.example). Build configuration only —
 * the extension itself never holds credentials.
 *
 * Unset (the default) means local development: http://127.0.0.1:8787.
 * Set means production, and must be an https:// origin — a shipped extension
 * may not talk to a plaintext endpoint.
 */
const DEV_DEFAULT = 'http://127.0.0.1:8787';
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

function resolveApiOrigin(env = process.env) {
  const configured = (env.EXETAZO_API_ORIGIN ?? '').trim();
  const origin = (configured || DEV_DEFAULT).replace(/\/+$/, '');

  if (!origin.startsWith('https://') && !LOOPBACK.test(origin)) {
    throw new Error(
      `EXETAZO_API_ORIGIN must be an https:// origin (http://127.0.0.1 and http://localhost are allowed for local development). Got: ${origin}`,
    );
  }

  return { origin, production: configured.length > 0 };
}

module.exports = { resolveApiOrigin, DEV_DEFAULT };
