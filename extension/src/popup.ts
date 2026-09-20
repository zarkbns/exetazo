import { LastScan } from './messages';

async function openSidePanelAndScan(): Promise<void> {
  const scanButton = document.getElementById('scan-button') as HTMLButtonElement | null;
  if (scanButton) scanButton.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true });
    } catch {
      // side panel may already be open; the scan continues regardless
    }
    await chrome.runtime.sendMessage({ type: 'EXETAZO_SCAN' });
  }

  window.close();
}

async function showLastResult(): Promise<void> {
  const box = document.getElementById('last-result');
  if (!box) return;
  const response = (await chrome.runtime.sendMessage({ type: 'EXETAZO_GET_LAST_SCAN' })) as {
    ok: boolean;
    lastScan: LastScan | null;
  };
  const lastScan = response?.lastScan;
  if (!response?.ok || !lastScan?.report) return;

  box.classList.remove('hidden');
  box.innerHTML = '';
  const score = document.createElement('span');
  score.className = 'score';
  score.textContent = String(lastScan.report.score);
  const level = document.createElement('span');
  level.className = 'level';
  level.textContent = `${lastScan.report.riskLevel.toUpperCase()} RISK · ${lastScan.report.findings.length} findings`;
  box.append(score, level);
}

document.getElementById('scan-button')?.addEventListener('click', () => void openSidePanelAndScan());
void showLastResult();
