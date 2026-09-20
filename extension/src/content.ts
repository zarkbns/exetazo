/**
 * Content script: extracts the page's legal text for analysis and
 * highlights evidence in the live page on demand. Injected on demand by the
 * background worker when a scan starts — it never runs uninvited.
 */

const BLOCK_SELECTOR =
  'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, dd, dt, td, th, caption, figcaption';

const REMOVE_SELECTOR =
  'script, style, noscript, template, svg, canvas, nav, header, footer, aside, form, button, iframe, dialog, select, textarea';

const NOISE_SELECTOR = [
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-modal="true"]',
  '[hidden]',
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="consent" i]',
  '[class*="newsletter" i]',
  '[class*="subscribe" i]',
  '[class*="promo" i]',
  '[class*="advert" i]',
  '[class*="sidebar" i]',
  '[class*="social" i]',
  '[class*="share" i]',
  '[class*="menu" i]',
  '[class*="footer" i]',
].join(', ');

export function extractLegalText(): { text: string; title: string; url: string } {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(REMOVE_SELECTOR).forEach((el) => el.remove());
  try {
    clone.querySelectorAll(NOISE_SELECTOR).forEach((el) => el.remove());
  } catch {
    // an invalid selector match on exotic pages must never break extraction
  }

  const parts: string[] = [];
  clone.querySelectorAll(BLOCK_SELECTOR).forEach((el) => {
    if (el.querySelector(BLOCK_SELECTOR)) return;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length >= 2) parts.push(text);
  });

  return { text: parts.join('\n\n'), title: document.title, url: location.href };
}

function ensureHighlightStyles(): void {
  if (document.getElementById('exetazo-styles')) return;
  const style = document.createElement('style');
  style.id = 'exetazo-styles';
  style.textContent = [
    'mark[data-exetazo] { background: #f1ff52; color: #191919; outline: 3px solid #ab9ff2;',
    '  outline-offset: 2px; border-radius: 2px; transition: background 1.4s ease; }',
    'mark[data-exetazo].settled { background: #e2dffe; outline-width: 2px; }',
  ].join(' ');
  document.head.appendChild(style);
}

function clearHighlights(): void {
  document.querySelectorAll('mark[data-exetazo]').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  });
}

function reveal(mark: HTMLElement): void {
  mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => mark.classList.add('settled'), 1600);
}

function wrapBlock(el: HTMLElement): void {
  ensureHighlightStyles();
  const mark = document.createElement('mark');
  mark.setAttribute('data-exetazo', '');
  while (el.firstChild) mark.appendChild(el.firstChild);
  el.appendChild(mark);
  reveal(mark);
}

function wrapRawText(textNode: Text, start: number, end: number): boolean {
  if (end <= start) return false;
  ensureHighlightStyles();
  try {
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const mark = document.createElement('mark');
    mark.setAttribute('data-exetazo', '');
    range.surroundContents(mark);
    reveal(mark);
    return true;
  } catch {
    return false;
  }
}

export function highlightEvidence(evidence: string): boolean {
  clearHighlights();
  const needle = evidence.replace(/\s+/g, ' ').trim().toLowerCase();
  if (needle.length < 8) return false;

  const blocks = Array.from(document.querySelectorAll(BLOCK_SELECTOR)) as HTMLElement[];
  for (const el of blocks) {
    if (el.querySelector(BLOCK_SELECTOR)) continue;
    if (el.closest('mark[data-exetazo]')) continue;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (text === needle || (needle.length >= 60 && text.includes(needle))) {
      wrapBlock(el);
      return true;
    }
  }

  // best-effort fallback: raw prefix search within a single text node
  const prefix = evidence.trim().slice(0, Math.min(120, evidence.trim().length));
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const value = node.textContent ?? '';
    const idx = value.toLowerCase().indexOf(prefix.toLowerCase());
    if (idx >= 0) {
      const wrapped = wrapRawText(node as Text, idx, idx + prefix.length);
      if (wrapped) return true;
    }
    node = walker.nextNode();
  }
  return false;
}

chrome.runtime.onMessage.addListener((message: { type?: string; evidence?: string }, _sender, sendResponse) => {
  if (message?.type === 'EXETAZO_EXTRACT') {
    const { text, title, url } = extractLegalText();
    sendResponse({ ok: true, text, title, url });
    return undefined;
  }
  if (message?.type === 'EXETAZO_HIGHLIGHT') {
    sendResponse({ ok: true, found: highlightEvidence(message.evidence ?? '') });
    return undefined;
  }
  return undefined;
});
