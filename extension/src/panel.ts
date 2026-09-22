/**
 * Opens Exetazo's report surface next to the page — Chrome's side panel or
 * Firefox's native sidebar, whichever this browser provides. Both render the
 * same sidepanel.html; there is exactly one report UI.
 */

interface ChromeApi {
  sidePanel?: {
    open(options: { tabId: number }): Promise<void>;
    setOptions(options: { tabId: number; path: string; enabled: boolean }): Promise<void>;
  };
}

interface WebExtApi {
  browser?: {
    sidebarAction?: {
      open(): Promise<void>;
    };
  };
}

export async function openReportPanel(tabId: number): Promise<void> {
  const api = globalThis.chrome as unknown as ChromeApi | undefined;
  if (api?.sidePanel) {
    // Chrome: same sequence as before — open, then pin the panel to this tab.
    try {
      await api.sidePanel.open({ tabId });
      await api.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
    } catch {
      // panel may already be open; the scan continues regardless
    }
    return;
  }

  const webext = globalThis as unknown as WebExtApi;
  if (webext.browser?.sidebarAction) {
    // Firefox: the native sidebar renders the same report and persists once
    // opened, so a failed programmatic open is not fatal — the sidebar button
    // still opens it, and the panel refreshes from session storage.
    try {
      await webext.browser.sidebarAction.open();
    } catch {
      // user can open it from the sidebar toolbar button; the scan continues
    }
    return;
  }

  throw new Error('No report panel API in this browser.');
}
