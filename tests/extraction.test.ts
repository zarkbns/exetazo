import { cleanText, MIN_LEGAL_WORDS } from '../server/analyzer/clean';

/**
 * Verbatim excerpts captured from live legal pages (GitHub Terms of Service,
 * Mozilla Terms of Service, Cloudflare Self-Serve Subscription Agreement).
 * These are the extraction false-negative controls: if cleaning ever drops
 * or mangles real clause text, these tests fail.
 */

const GITHUB_MODIFICATION =
  'We reserve the right, at our sole discretion, to amend these Terms of Service at any time and will update these Terms of Service in the event of any such amendments. We will notify our Users of material changes to this Agreement, such as price increases, at least 30 days prior to the change taking effect by posting a notice on our Website or sending email to the primary email address specified in your GitHub account. Customer\'s continued use of the Service after those 30 days constitutes agreement to those revisions of this Agreement.';

const GITHUB_TERMINATION =
  'GitHub has the right to suspend or terminate your access to all or any part of the Website at any time, with or without cause, with or without notice, effective immediately. GitHub reserves the right to refuse service to anyone for any reason at any time.';

const GITHUB_CANCELLATION =
  'It is your responsibility to properly cancel your Account with GitHub. You can cancel your Account at any time by going into your Settings in the global navigation bar at the top of the screen. The Account screen provides a simple, no questions asked cancellation link. We are not able to cancel Accounts in response to an email or phone request.';

const GITHUB_VENUE =
  'You and GitHub agree to submit to the exclusive jurisdiction and venue of the courts located in the City and County of San Francisco, California.';

const GITHUB_RAW = [
  'Skip to content',
  'Sign up',
  '',
  'GitHub Docs | Site policy | GitHub Terms of Service',
  '',
  'M. Cancellation and Termination',
  GITHUB_TERMINATION,
  GITHUB_CANCELLATION,
  '',
  'R. Changes to These Terms',
  GITHUB_MODIFICATION,
  '',
  'S. Miscellaneous',
  GITHUB_VENUE,
  '',
  '© 2026 GitHub, Inc.',
  'Manage cookies',
  'We use cookies to operate our site.',
].join('\n');

const MOZILLA_LIABILITY =
  'EXCEPT AS REQUIRED BY LAW, MOZILLA AND THE INDEMNIFIED PARTIES WILL NOT BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES ARISING OUT OF OR IN ANY WAY RELATING TO THESE TERMS OR THE USE OF OR INABILITY TO USE THE COMMUNICATIONS, INCLUDING WITHOUT LIMITATION DIRECT AND INDIRECT DAMAGES FOR LOSS OF GOODWILL, WORK STOPPAGE, LOST PROFITS, LOSS OF DATA, AND COMPUTER FAILURE OR MALFUNCTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES AND REGARDLESS OF THE THEORY (CONTRACT, TORT, OR OTHERWISE) UPON WHICH SUCH CLAIM IS BASED.';

const MOZILLA_RAW = [
  'Firefox',
  'Menu | Products | About',
  '',
  '10. Disclaimer; Limitation of Liability',
  MOZILLA_LIABILITY,
  '',
  '11. Modifications to These Terms',
  'We may update these Terms from time to time to address a new feature of the Communications or to clarify a provision. The updated Terms will be posted online. Your continued use of our Communications after the effective date of such changes constitutes your acceptance of such changes.',
  '',
  'Back to top',
].join('\n');

const CLOUDFLARE_RENEWAL =
  'All of your subscriptions to Paid Services with a Subscription Term will automatically renew for periods equal to your initial Subscription Term, and you will be charged at our then-current rates unless you cancel your subscription through the Services\' account dashboard prior to your next scheduled billing date.';

const CLOUDFLARE_RAW = [
  'Cloudflare',
  'Products | Solutions | Pricing | Enterprise | Sign up',
  '',
  'Accept all',
  'This website uses cookies to ensure you get the best experience.',
  '',
  '2.4 Subscription Terms, Renewals, and Cancellations',
  CLOUDFLARE_RENEWAL,
  '',
  'Copyright © 2026 Cloudflare, Inc.',
].join('\n');

describe('text cleaning', () => {
  it('strips navigation, cookie banners, and footer chrome', () => {
    const cleaned = cleanText(GITHUB_RAW);
    const all = cleaned.fullText;
    expect(all).not.toContain('Sign up');
    expect(all).not.toContain('Skip to content');
    expect(all).not.toContain('We use cookies');
    expect(all).not.toContain('© 2026');
    expect(all).not.toContain('Manage cookies');
    expect(all).not.toContain('|');
  });

  it('preserves real clause text verbatim', () => {
    const github = cleanText(GITHUB_RAW);
    expect(github.fullText).toContain(GITHUB_TERMINATION);
    expect(github.fullText).toContain(GITHUB_MODIFICATION);
    expect(github.fullText).toContain(GITHUB_CANCELLATION);
    expect(github.fullText).toContain(GITHUB_VENUE);

    const mozilla = cleanText(MOZILLA_RAW);
    expect(mozilla.fullText).toContain(MOZILLA_LIABILITY);

    const cloudflare = cleanText(CLOUDFLARE_RAW);
    expect(cloudflare.fullText).toContain(CLOUDFLARE_RENEWAL);
  });

  it('maps paragraphs to their section headings', () => {
    const github = cleanText(GITHUB_RAW);
    const termination = github.paragraphs.find((p) => p.text.startsWith('GitHub has the right'))!;
    expect(termination.section).toBe('M. Cancellation and Termination');
    const venue = github.paragraphs.find((p) => p.text.startsWith('You and GitHub agree'))!;
    expect(venue.section).toBe('S. Miscellaneous');
  });

  it('keeps character offsets consistent with fullText', () => {
    const github = cleanText(GITHUB_RAW);
    for (const p of github.paragraphs) {
      expect(github.fullText.slice(p.offset, p.offset + p.text.length)).toBe(p.text);
      expect(p.index).toBe(github.paragraphs.indexOf(p));
    }
  });

  it('counts words across the cleaned document', () => {
    const github = cleanText(GITHUB_RAW);
    expect(github.wordCount).toBeGreaterThan(MIN_LEGAL_WORDS);
    expect(github.wordCount).toBe(github.fullText.split(/\s+/).filter(Boolean).length);
  });

  it('splits one giant unpunctuated-block document into clause-sized paragraphs', () => {
    const sentence = 'We may share your personal information with third parties for any purpose we deem appropriate. ';
    const blob = sentence.repeat(120); // ~11k chars, no newlines
    const cleaned = cleanText(blob);
    expect(cleaned.paragraphs.length).toBeGreaterThan(2);
    for (const p of cleaned.paragraphs) {
      expect(p.text.length).toBeLessThanOrEqual(1200);
    }
    expect(cleaned.fullText).toContain('We may share your personal information');
  });

  it('warns and truncates oversized input', () => {
    const raw = 'Legal text line. '.repeat(60_000); // > 400k chars
    const cleaned = cleanText(raw);
    expect(cleaned.warnings.some((w) => w.includes('truncated'))).toBe(true);
  });

  it('recognizes near-empty pages as too short to be legal text', () => {
    const cleaned = cleanText('Sign in\nAccept all\nHome');
    expect(cleaned.wordCount).toBeLessThan(MIN_LEGAL_WORDS);
  });
});
