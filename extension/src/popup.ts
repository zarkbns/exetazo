import { LastScan } from './messages';
import { openReportPanel } from './panel';

async function openSidePanelAndScan(): Promise<void> {
  const scanButton = document.getElementById('scan-button') as HTMLButtonElement | null;
  if (scanButton) scanButton.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    try {
      await openReportPanel(tab.id);
    } catch {
      // no report surface in this browser; the scan still runs in the popup
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
