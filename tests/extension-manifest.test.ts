// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GECKO_ID, toFirefoxManifest, withApiOrigin } = require('../scripts/firefox-manifest.cjs') as {
  GECKO_ID: string;
  toFirefoxManifest(manifest: typeof CHROME_MANIFEST): Record<string, any>;
  withApiOrigin(manifest: typeof CHROME_MANIFEST, origin: string, production: boolean): typeof CHROME_MANIFEST;
};

const CHROME_MANIFEST = {
  manifest_version: 3,
  name: 'Exetazo — Legal security before you agree',
  version: '0.1.0',
  description: 'Scans legal agreements for risky clauses. Not legal advice.',
  minimum_chrome_version: '116',
  permissions: ['activeTab', 'scripting', 'sidePanel', 'storage'],
  host_permissions: ['http://127.0.0.1/*', 'http://localhost/*'],
  background: { service_worker: 'background.js' },
  action: {
    default_title: 'Exetazo — scan this page',
    default_popup: 'popup.html',
    default_icon: { '16': 'assets/icon16.png', '128': 'assets/icon128.png' },
  },
  side_panel: { default_path: 'sidepanel.html' },
  icons: { '16': 'assets/icon16.png', '128': 'assets/icon128.png' },
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
};

describe('Firefox manifest transform', () => {
  it('runs the background as a Firefox event page instead of a service worker', () => {
    const firefox = toFirefoxManifest(CHROME_MANIFEST);
    expect(firefox.background).toEqual({ scripts: ['background.js'] });
    expect(firefox.background.service_worker).toBeUndefined();
  });

  it('uses the native sidebar and drops the Chrome side panel', () => {
    const firefox = toFirefoxManifest(CHROME_MANIFEST);
    expect(firefox.sidebar_action).toEqual({
      default_panel: 'sidepanel.html',
      default_title: 'Exetazo — scan this page',
      default_icon: { '16': 'assets/icon16.png', '128': 'assets/icon128.png' },
    });
    expect(firefox.side_panel).toBeUndefined();
    expect(firefox.permissions).toEqual(['activeTab', 'scripting', 'storage']);
  });

  it('declares gecko settings so the build is AMO-signable', () => {
    const firefox = toFirefoxManifest(CHROME_MANIFEST);
    expect(firefox.browser_specific_settings.gecko.id).toBe(GECKO_ID);
    expect(firefox.browser_specific_settings.gecko.strict_min_version).toBe('142.0');
    // Honest disclosure: a scan sends the page's legal text to the API
    // (transiently, never stored) — so not "none".
    expect(firefox.browser_specific_settings.gecko.data_collection_permissions).toEqual({
      required: ['websiteContent'],
    });
  });

  it('drops Chrome-only keys and preserves everything shared', () => {
    const firefox = toFirefoxManifest(CHROME_MANIFEST);
    expect(firefox.minimum_chrome_version).toBeUndefined();
    expect(firefox.manifest_version).toBe(3);
    expect(firefox.name).toBe(CHROME_MANIFEST.name);
    expect(firefox.version).toBe(CHROME_MANIFEST.version);
    expect(firefox.action).toEqual(CHROME_MANIFEST.action);
    expect(firefox.icons).toEqual(CHROME_MANIFEST.icons);
    expect(firefox.content_security_policy).toEqual(CHROME_MANIFEST.content_security_policy);
  });

  it('keeps dev host permissions and narrows them only in production', () => {
    const dev = withApiOrigin(CHROME_MANIFEST, 'https://api.example.com', false);
    expect(dev.host_permissions).toEqual(CHROME_MANIFEST.host_permissions);

    const prod = withApiOrigin(CHROME_MANIFEST, 'https://api.example.com', true);
    expect(prod.host_permissions).toEqual(['https://api.example.com/*']);
  });

  it('carries the production API origin into the Firefox variant', () => {
    const prod = withApiOrigin(CHROME_MANIFEST, 'https://api.example.com', true);
    const firefox = toFirefoxManifest(prod);
    expect(firefox.host_permissions).toEqual(['https://api.example.com/*']);
    expect(firefox.sidebar_action.default_panel).toBe('sidepanel.html');
  });
});
