// utils/notifications.js
// Dispatches in-page toast messages to tabs and broadcasts status to popup UI.
// Does NOT use OS/Windows desktop notifications.

import { log } from './helpers.js';

/**
 * Sends an in-page toast notification to the specified tab (or active tab).
 * @param {number|null} tabId Tab ID to send toast to, or null for active tab
 * @param {'progress'|'success'|'error'} type 
 * @param {string} title 
 * @param {string} message 
 */
export async function showTabToast(tabId, type, title, message) {
  log(`[Toast ${type.toUpperCase()}]`, title, '-', message);

  try {
    let targetTabId = tabId;
    if (!targetTabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTabId = activeTab?.id;
    }

    if (targetTabId) {
      await chrome.tabs.sendMessage(targetTabId, {
        action: 'showToast',
        type,
        title,
        message
      }).catch(() => {
        // Tab might not have content script ready; safe to ignore
      });
    }
  } catch (err) {
    log('Failed to dispatch toast to tab:', err);
  }

  // Also broadcast to popup if open
  try {
    chrome.runtime.sendMessage({
      action: 'exportProgress',
      stage: type === 'progress' ? 'Working' : (type === 'success' ? 'Saved' : 'Error'),
      message: message || title
    }).catch(() => {
      // Harmless if popup is not open
    });
  } catch {
    // Harmless
  }
}

export function showProgress(tabId, message, title = 'Drive PDF Saver') {
  return showTabToast(tabId, 'progress', title, message);
}

export function showSuccess(tabId, message, title = '✓ PDF Saved to Drive') {
  return showTabToast(tabId, 'success', title, message);
}

export function showError(tabId, message, title = 'Save as PDF Failed') {
  return showTabToast(tabId, 'error', title, message);
}
