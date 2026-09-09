// utils/notifications.js

import { log } from './helpers.js';

const NOTIFICATION_ICON = 'icons/icon128.png';

/**
 * Creates or updates a Chrome notification.
 * @param {string} title 
 * @param {string} message 
 * @param {boolean} isError 
 */
export function showNotification(title, message, isError = false) {
  log(isError ? 'NOTIFICATION ERROR:' : 'NOTIFICATION:', title, '-', message);
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: NOTIFICATION_ICON,
      title: title,
      message: message,
      priority: isError ? 2 : 1
    });
  } catch (err) {
    log('Failed to show notification:', err);
  }
}

export function showProgress(message) {
  showNotification('Save as PDF to Google Drive', message, false);
}

export function showSuccess(message) {
  showNotification('✓ PDF Saved', message, false);
}

export function showError(message) {
  showNotification('PDF Save Failed', message, true);
}
