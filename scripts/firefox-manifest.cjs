/**
 * Manifest transforms for the Firefox build — the entire browser difference
 * lives here. One source manifest, two targets:
 *
 *   Chrome  → sidePanel API, service-worker background   (extension/dist)
 *   Firefox → native sidebar_action, event-page background (extension/dist-firefox)
 *
 * Everything else — UI, contracts, analyzer, permissions posture — is shared.
 */

const GECKO_ID = 'exetazo@exetazo.xyz';
// 142+ is required by the data_collection_permissions disclosure key below
// (142 on Firefox for Android, 140 on desktop); Firefox auto-updates, so this
// excludes only years-old installs.
const GECKO_MIN_VERSION = '142.0';

/**
 * Production builds call exactly one API origin, so host_permissions narrow to
 * it; dev builds keep the loopback origins. Applies to both browser targets.
 */
function withApiOrigin(manifest, origin, production) {
  if (!production) return manifest;
  return { ...manifest, host_permissions: [`${origin}/*`] };
}

function toFirefoxManifest(chromeManifest) {
  const { minimum_chrome_version, side_panel, background, permissions, ...rest } = chromeManifest;

  return {
    ...rest,
    permissions: permissions.filter((permission) => permission !== 'sidePanel'),
    background: {
      // Firefox MV3 runs a non-persistent event page instead of a service worker.
      scripts: [background.service_worker ?? background.scripts?.[0]],
    },
    sidebar_action: {
      default_panel: side_panel?.default_path ?? 'sidepanel.html',
      default_title: chromeManifest.action?.default_title ?? chromeManifest.name,
      ...(chromeManifest.action?.default_icon
        ? { default_icon: chromeManifest.action.default_icon }
        : {}),
    },
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        strict_min_version: GECKO_MIN_VERSION,
        // Required by AMO for new extensions. A scan transmits the page's
        // legal text to the API for analysis — transiently, never stored —
        // so it is disclosed honestly rather than declared "none".
        data_collection_permissions: { required: ['websiteContent'] },
      },
    },
  };
}

module.exports = { GECKO_ID, GECKO_MIN_VERSION, withApiOrigin, toFirefoxManifest };
