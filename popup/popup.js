// popup/popup.js

import { extractGoogleFileInfo } from '../services/file.js';

const supportedView = document.getElementById('supported-view');
const unsupportedView = document.getElementById('unsupported-view');
const fileNameEl = document.getElementById('file-name');
const fileTypeEl = document.getElementById('file-type');
const statusBadge = document.getElementById('status-badge');
const statusDetail = document.getElementById('status-detail');
const saveBtn = document.getElementById('save-btn');

const SERVICE_NAMES = {
  docs: 'Google Docs',
  sheets: 'Google Sheets',
  slides: 'Google Slides',
  drawings: 'Google Drawings',
  'drive-file': 'Google Drive File'
};

let currentTab = null;
let currentFileInfo = null;

document.addEventListener('DOMContentLoaded', async () => {
  initPopup();
  setupEvents();
});

async function initPopup() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showUnsupported();
      return;
    }

    currentTab = tab;
    currentFileInfo = extractGoogleFileInfo(tab.url);

    if (!currentFileInfo) {
      showUnsupported();
      return;
    }

    showSupported(tab, currentFileInfo);
  } catch (err) {
    console.error('[DrivePDF Popup] Initialization error:', err);
    showUnsupported();
  }
}

function showUnsupported() {
  supportedView.classList.add('hidden');
  unsupportedView.classList.remove('hidden');
}

function showSupported(tab, fileInfo) {
  unsupportedView.classList.add('hidden');
  supportedView.classList.remove('hidden');

  fileTypeEl.textContent = SERVICE_NAMES[fileInfo.service] || 'Google Drive File';
  
  // Tab title usually contains "Document Name - Google Docs" or "Document Name - Google Drive"
  let docTitle = tab.title || 'Current Document';
  docTitle = docTitle.replace(/ - Google (Docs|Sheets|Slides|Drawings|Drive)$/i, '').trim();
  fileNameEl.textContent = docTitle || 'Drive File';

  setStatus('ready', 'Ready', '');
}

function setStatus(type, badgeText, detailText) {
  statusBadge.className = `badge status-${type}`;
  statusBadge.textContent = badgeText;
  statusDetail.textContent = detailText;
}

function setupEvents() {
  saveBtn.addEventListener('click', async () => {
    if (!currentTab || !currentFileInfo) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving to Drive...';
    setStatus('working', 'Exporting...', 'Initiating PDF export from Google Drive API...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveAsPdf',
        tabId: currentTab.id,
        fileInfo: currentFileInfo
      });

      if (response && response.success) {
        const actionWord = response.isUpdate ? 'updated' : 'saved';
        setStatus('success', 'Saved', `✓ ${response.pdfName} ${actionWord} in the same folder.`);
        saveBtn.textContent = '✓ Saved to Google Drive';
        setTimeout(() => {
          saveBtn.textContent = 'Save as PDF to Google Drive';
          saveBtn.disabled = false;
        }, 3500);
      } else {
        const errorMsg = response?.error || 'An unexpected error occurred.';
        setStatus('error', 'Error', errorMsg);
        saveBtn.textContent = 'Save as PDF to Google Drive';
        saveBtn.disabled = false;
      }
    } catch (err) {
      console.error('[DrivePDF Popup] Save error:', err);
      setStatus('error', 'Error', err.message || 'Communication error.');
      saveBtn.textContent = 'Save as PDF to Google Drive';
      saveBtn.disabled = false;
    }
  });

  // Listen for broadcast progress notifications from background worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'exportProgress') {
      setStatus('working', message.stage || 'Working', message.message || '');
    }
  });
}
