/**
 * Real-page validation harness.
 *
 * Scans live legal pages end to end: fetch → extract → POST /analyze twice →
 * compare. Reports score, level, finding counts, latency, and whether the two
 * runs produced identical findings.
 *
 * Usage:
 *   npm run build:server
 *   node dist/server/api/main.js            # in another shell
 *   npm run validate:pages
 *
 * Reproducibility note: the score is deterministic only on the rules path. If
 * the server has semantic analysis enabled (OPENAI_API_KEY set) the model can
 * add findings the rules missed, and those findings subtract from the score —
 * so a live model can make two scans of the same page differ. Run the demo
 * with the AI env vars unset for a score judges can reproduce.
 *
 * The extraction here is a deliberately crude, DOM-less approximation of the
 * extension's content script (which reads the rendered page). The server
 * re-cleans whatever it receives, so results reflect the real analysis path.
 */
const API = process.env.EXETAZO_API ?? 'http://127.0.0.1:8787/analyze';
const TIMEOUT_MS = 45_000;

const PAGES = [
  ['GitHub Terms of Service', 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service'],
  ['GitHub Privacy Statement', 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement'],
  ['Google Terms of Service', 'https://policies.google.com/terms'],
  ['AWS Service Terms', 'https://aws.amazon.com/service-terms/'],
  ['Figma Terms of Service', 'https://www.figma.com/legal/tos/'],
];

function htmlToText(html) {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<\/?(nav|header|footer|aside|form|button|select|textarea|dialog)[^>]*>/gi, ' ');
  s = s.replace(/<\/(p|div|li|h[1-6]|section|article|blockquote|tr|td|th|dd|dt|pre|caption)>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
  return s
    .split('\n')
    .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .filter((line) => line.length >= 2)
    .join('\n\n');
}

async function analyze(text, title, url) {
  const started = Date.now();
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title, url }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { ms: Date.now() - started, status: res.status, body: await res.json() };
}

(async () => {
  const results = [];
  let nonDeterministic = 0;

  for (const [name, url] of PAGES) {
    console.log(`\n=== ${name} ===`);
    try {
      const page = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ExetazoValidation/0.1)' },
      });
      const html = await page.text();
      const text = htmlToText(html);
      const words = text.split(/\s+/).filter(Boolean).length;
      console.log(`fetched ${html.length}B html -> ${text.length}B text, ${words} words`);

      const first = await analyze(text, name, url);
      if (first.status !== 200) {
        console.log(`  HTTP ${first.status}: ${JSON.stringify(first.body).slice(0, 160)}`);
        results.push(`${name}: not analyzable (${words} words extracted)`);
        continue;
      }
      const second = await analyze(text, name, url);
      const a = first.body;
      const b = second.body;
      const sameScore = a.score === b.score;
      const sameFindings = JSON.stringify(a.findings) === JSON.stringify(b.findings);
      if (!sameScore || !sameFindings) nonDeterministic += 1;

      console.log(`  score ${a.score}/100 ${a.riskLevel.toUpperCase()} — ${a.findings.length} findings`);
      console.log(`  counts: ${a.counts.critical} critical, ${a.counts.high} high, ${a.counts.medium} medium, ${a.counts.low} low`);
      console.log(`  timing: ${first.ms}ms then ${second.ms}ms (budget 5000ms)`);
      console.log(`  deterministic: score=${sameScore} findings=${sameFindings}`);
      console.log(
        a.aiUsed
          ? '  AI: USED — the model contributed findings, so the score is not guaranteed reproducible'
          : '  AI: not used — rules-only, score is reproducible',
      );
      for (const warning of a.warnings) console.log(`  warning: ${warning}`);
      for (const f of a.findings) {
        console.log(`   - [${f.severity}] ${f.category} (${f.confidence}%) ${f.location.section ?? ''}`);
        console.log(`       ${f.evidence.replace(/\s+/g, ' ').slice(0, 150)}`);
      }
      results.push(`${name}: ${a.score}/100 ${a.riskLevel.toUpperCase()}, ${a.findings.length} findings, ${first.ms}ms`);
    } catch (err) {
      console.log(`  FAILED: ${err instanceof Error ? err.message : String(err)}`);
      results.push(`${name}: fetch failed`);
    }
  }

  console.log('\n=== summary ===');
  for (const line of results) console.log(` ${line}`);
  console.log(
    nonDeterministic === 0
      ? '\ndeterminism: every analyzable page produced identical findings twice.'
      : `\ndeterminism: ${nonDeterministic} page(s) differed between runs.`,
  );
  process.exit(nonDeterministic === 0 ? 0 : 1);
})();
