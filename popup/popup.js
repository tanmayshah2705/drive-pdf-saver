// popup/popup.js — Multi-account Drive PDF Saver popup

import { extractGoogleFileInfo } from '../services/file.js';
import { getConnectedAccounts, connectAccount, disconnectAccount } from '../services/accounts.js';

// -- DOM refs ------------------------------------------------------------------
const supportedView   = document.getElementById('supported-view');
const unsupportedView = document.getElementById('unsupported-view');
const fileNameEl      = document.getElementById('file-name');
const fileTypeEl      = document.getElementById('file-type');
const statusBadge     = document.getElementById('status-badge');
const statusDetail    = document.getElementById('status-detail');
const saveBtn         = document.getElementById('save-btn');
const connectBtn      = document.getElementById('connect-btn');
const accountsList    = document.getElementById('accounts-list');

const SERVICE_NAMES = {
  docs:        'Google Docs',
  sheets:      'Google Sheets',
  slides:      'Google Slides',
  drawings:    'Google Drawings',
  'drive-file': 'Google Drive File',
};

let currentTab      = null;
let currentFileInfo = null;

// -- Init ---------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  await initPopup();
  await renderAccountsList();
  setupEvents();
});

async function initPopup() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) { showUnsupported(); return; }

    currentTab = tab;
    currentFileInfo = extractGoogleFileInfo(tab.url) || {};

    // Query active tab's content script to retrieve in-page active account hint
    try {
      const tabInfo = await chrome.tabs.sendMessage(tab.id, { action: 'getFileInfo' });
      if (tabInfo) {
        currentFileInfo = { ...currentFileInfo, ...tabInfo };
      }
    } catch {
      // Content script may not be available on some internal pages
    }

    if (!currentFileInfo || !currentFileInfo.fileId) {
      showUnsupported();
      return;
    }

    showSupported(tab, currentFileInfo);
  } catch (err) {
    console.error('[DrivePDF Popup] Initialization error:', err);
    showUnsupported();
  }
}

// -- File views ---------------------------------------------------------------

function showUnsupported() {
  supportedView.classList.add('hidden');
  unsupportedView.classList.remove('hidden');
}

function showSupported(tab, fileInfo) {
  unsupportedView.classList.add('hidden');
  supportedView.classList.remove('hidden');

  fileTypeEl.textContent = SERVICE_NAMES[fileInfo.service] || 'Google Drive File';

  let docTitle = tab.title || 'Current Document';
  docTitle = docTitle.replace(/ - Google (Docs|Sheets|Slides|Drawings|Drive)$/i, '').trim();
  fileNameEl.textContent = docTitle || 'Drive File';

  const activeEmail = fileInfo.activeAccountHint && fileInfo.activeAccountHint.email;
  if (activeEmail) {
    setStatus('ready', 'Ready', 'Active tab account: ' + activeEmail);
  } else {
    setStatus('ready', 'Ready', '');
  }
}

function setStatus(type, badgeText, detailText) {
  statusBadge.className = 'badge status-' + type;
  statusBadge.textContent = badgeText;
  statusDetail.textContent = detailText;
}

// -- Accounts list ------------------------------------------------------------

async function renderAccountsList() {
  let accounts = [];
  try {
    accounts = await getConnectedAccounts();
  } catch (err) {
    console.error('[DrivePDF Popup] Could not load accounts:', err);
  }

  accountsList.innerHTML = '';

  if (accounts.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'account-placeholder';
    placeholder.textContent = 'No accounts connected. Click + Connect to add one.';
    accountsList.appendChild(placeholder);
    return;
  }

  accounts.forEach(function(account) {
    const row = document.createElement('div');
    row.className = 'account-row';
    row.dataset.email = account.email;

    const info = document.createElement('div');
    info.className = 'account-info';

    const name = document.createElement('span');
    name.className = 'account-name';
    name.textContent = account.displayName || account.email;

    const email = document.createElement('span');
    email.className = 'account-email';
    email.textContent = account.email;

    info.appendChild(name);
    info.appendChild(email);

    const disconnectBtnEl = document.createElement('button');
    disconnectBtnEl.className = 'text-btn disconnect-btn';
    disconnectBtnEl.title = 'Disconnect ' + account.email;
    disconnectBtnEl.textContent = 'Disconnect';
    disconnectBtnEl.addEventListener('click', function() {
      handleDisconnect(account.email, row);
    });

    row.appendChild(info);
    row.appendChild(disconnectBtnEl);
    accountsList.appendChild(row);
  });
}

// -- Events -------------------------------------------------------------------

function setupEvents() {
  // Save button
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!currentTab || !currentFileInfo) return;

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving to Drive...';
      setStatus('working', 'Exporting...', 'Initiating PDF export from Google Drive API...');

      try {
        const response = await chrome.runtime.sendMessage({
          action:   'saveAsPdf',
          tabId:    currentTab.id,
          fileInfo: currentFileInfo,
        });

        if (response && response.success) {
          const actionWord = response.isUpdate ? 'updated' : 'saved';
          setStatus('success', 'Saved', '✓ ' + response.pdfName + ' ' + actionWord + ' in the same folder.');
          saveBtn.textContent = '✓ Saved to Google Drive';
          setTimeout(function() {
            saveBtn.textContent = 'Save as PDF to Google Drive';
            saveBtn.disabled = false;
          }, 3500);
        } else {
          const errorMsg = (response && response.error) || 'An unexpected error occurred.';
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
  }

  // Listen for broadcast progress notifications from background worker
  chrome.runtime.onMessage.addListener(function(message) {
    if (message.action === 'exportProgress') {
      setStatus('working', message.stage || 'Working', message.message || '');
    }
  });

  // Connect account button
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      connectBtn.disabled = true;
      connectBtn.textContent = 'Connecting...';

      try {
        const response = await chrome.runtime.sendMessage({ action: 'connectAccount' });
        if (response && response.success) {
          await renderAccountsList();
          setStatus('ready', 'Ready', response.account.email + ' connected.');
        } else {
          throw new Error((response && response.error) || 'Failed to connect Google account.');
        }
      } catch (err) {
        console.error('[DrivePDF Popup] Connect error:', err);
        setStatus('error', 'Error', err.message || 'Failed to connect Google account.');
      } finally {
        connectBtn.textContent = '+ Connect';
        connectBtn.disabled = false;
      }
    });
  }

  // Auto-refresh accounts list when storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['drive_pdf_accounts']) {
      renderAccountsList();
    }
  });
}

async function handleDisconnect(email, rowEl) {
  rowEl.style.opacity = '0.5';
  try {
    const response = await chrome.runtime.sendMessage({ action: 'disconnectAccount', email });
    if (response && response.success) {
      await renderAccountsList();
      setStatus('ready', 'Ready', email + ' disconnected.');
    } else {
      throw new Error((response && response.error) || 'Failed to disconnect account.');
    }
  } catch (err) {
    console.error('[DrivePDF Popup] Disconnect error:', err);
    rowEl.style.opacity = '1';
    setStatus('error', 'Error', 'Failed to disconnect: ' + (err.message || err));
  }
}
