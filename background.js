// background.js — Service Worker (ES Module)
// Orchestrates PDF export and conversion directly via official Google Drive API v3.

import { resolveTokenForTab, verifyCurrentFileAccess } from './services/auth.js';
import { connectAccount, disconnectAccount } from './services/accounts.js';
import { findExistingPdf, uploadNewPdf, updateExistingPdfContent } from './services/drive.js';
import { exportFileToPdf } from './services/export.js';
import { extractGoogleFileInfo, isConvertible, generatePdfName, getConversionCategory } from './services/file.js';
import { showProgress, showSuccess, showError } from './utils/notifications.js';
import { log } from './utils/helpers.js';

const CONTEXT_MENU_ID = 'save-as-pdf-to-drive';

// Supported URLs: Google Docs, Sheets, Slides, Drawings, and Google Drive File Previews
const SUPPORTED_PATTERNS = [
  'https://docs.google.com/document/*',
  'https://docs.google.com/spreadsheets/*',
  'https://docs.google.com/presentation/*',
  'https://docs.google.com/drawings/*',
  'https://drive.google.com/file/*',
  'https://drive.google.com/open*'
];

// ============================================================================
// 1. Context Menu Lifecycle
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Save as PDF to Google Drive',
      contexts: ['page'],
      documentUrlPatterns: SUPPORTED_PATTERNS
    });
    log('Context menu registered for supported Google Drive and Workspace URLs.');
  });
});

// Top-level listener to wake up MV3 service worker
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    log('Context menu clicked on tab:', tab?.id, tab?.url);
    handleContextMenuAction(tab, info.pageUrl);
  }
});

// Top-level message listener for popup and other extension components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveAsPdf') {
    log('Save as PDF requested from popup for tab:', message.tabId);
    
    processExportPipeline(message.fileInfo, message.tabId)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => {
        showError(message.tabId, err.message || 'Failed to save PDF.');
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }

  if (message.action === 'connectAccount') {
    log('Connect account requested from popup');
    connectAccount(message.loginHint)
      .then((account) => sendResponse({ success: true, account }))
      .catch((err) => {
        log('connectAccount failed:', err);
        sendResponse({ success: false, error: (err && err.message) ? err.message : String(err) });
      });

    return true; // Keep message channel open for async response
  }

  if (message.action === 'disconnectAccount') {
    log('Disconnect account requested for:', message.email);
    disconnectAccount(message.email)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        log('disconnectAccount failed:', err);
        sendResponse({ success: false, error: (err && err.message) ? err.message : String(err) });
      });

    return true; // Keep message channel open for async response
  }
});

// ============================================================================
// 2. Context Menu Handler
// ============================================================================

async function handleContextMenuAction(tab, pageUrl) {
  const tabId = tab?.id;
  try {
    const url = tab?.url || pageUrl;
    let fileInfo = extractGoogleFileInfo(url) || {};

    // Attach account hint from URL as baseline
    if (url) {
      fileInfo.activeAccountHint = detectAccountHintFromUrl(url);
    }

    // Always query content script in the active tab for the live in-page active account
    if (tabId) {
      try {
        const tabInfo = await chrome.tabs.sendMessage(tabId, { action: 'getFileInfo' });
        if (tabInfo) {
          fileInfo = {
            ...fileInfo,
            ...tabInfo,
            activeAccountHint: {
              ...(fileInfo.activeAccountHint || {}),
              ...(tabInfo.activeAccountHint || {})
            }
          };
        }
      } catch (scriptErr) {
        log('Content script query failed:', scriptErr);
      }
    }

    if (!fileInfo || !fileInfo.fileId) {
      showError(tabId, 'Could not identify the current Google Drive file.');
      return;
    }

    await processExportPipeline(fileInfo, tabId);
  } catch (err) {
    log('Context menu processing failed:', err);
    showError(tabId, err.message || 'Failed to save PDF to Google Drive.');
  }
}

/**
 * Extracts an account hint from a Google URL (mirrors content.js logic, for cases
 * where the content script is not available, e.g. Drive file preview pages).
 * @param {string} url
 * @returns {{ userIndex: number|null, email: string|null }}
 */
function detectAccountHintFromUrl(url) {
  if (!url) return { userIndex: null, email: null };
  let userIndex = null;
  let email = null;

  const uMatch = url.match(/\/u\/(\d+)\//);
  if (uMatch) userIndex = parseInt(uMatch[1], 10);

  try {
    const parsed = new URL(url);
    const authuser = parsed.searchParams.get('authuser');
    if (authuser !== null) {
      if (authuser.includes('@')) {
        email = authuser.toLowerCase().trim();
      } else {
        const idx = parseInt(authuser, 10);
        if (!isNaN(idx)) userIndex = idx;
      }
    }
  } catch { /* ignore */ }

  if (userIndex === null && url && (url.includes('docs.google.com') || url.includes('drive.google.com'))) {
    userIndex = 0;
  }

  return { userIndex, email };
}


// ============================================================================
// 3. Core Export Pipeline (Google Drive API)
// ============================================================================

/**
 * Executes the universal Google Drive PDF export/conversion pipeline.
 * @param {{ fileId: string, service?: string, activeAccountHint?: {userIndex:number|null, email:string|null} }} fileInfo
 * @param {number|null} [tabId] Target browser tab ID for in-page status toasts
 * @returns {Promise<{ pdfName: string, isUpdate: boolean }>}
 */
async function processExportPipeline(fileInfo, tabId = null) {
  if (!fileInfo || !fileInfo.fileId) {
    throw new Error('Could not identify the current Google file.');
  }

  const { fileId } = fileInfo;
  let activeAccountHint = fileInfo.activeAccountHint || {};

  // If activeAccountHint has no email, query content script in the active tab
  if (!activeAccountHint.email && tabId) {
    try {
      const tabInfo = await chrome.tabs.sendMessage(tabId, { action: 'getFileInfo' });
      if (tabInfo && tabInfo.activeAccountHint) {
        activeAccountHint = {
          ...activeAccountHint,
          ...tabInfo.activeAccountHint
        };
      }
    } catch (tabErr) {
      log('Could not query active tab for account hint:', tabErr);
    }
  }

  // Fallback to URL detection if needed
  if (!activeAccountHint.email && fileInfo.url) {
    const urlHint = detectAccountHintFromUrl(fileInfo.url);
    activeAccountHint = { ...urlHint, ...activeAccountHint };
  }

  log(`Starting export pipeline for file ID: ${fileId}, tab: ${tabId}, accountHint:`, activeAccountHint);

  // Step 1: Resolve which connected Google account token to use for this tab
  showProgress(tabId, 'Connecting to Google Drive...', 'Drive PDF Saver');
  const { token, email } = await resolveTokenForTab(activeAccountHint);
  log(`Using token for account: ${email}`);

  // Step 2: Verify account access and fetch authoritative file metadata from Drive API
  showProgress(tabId, 'Verifying permissions and file details...', 'Checking Document');
  const verified = await verifyCurrentFileAccess(token, fileId);
  const metadata = verified.metadata;
  const activeToken = verified.token || token;

  // Step 3: Verify that the file can be converted to PDF
  if (!isConvertible(metadata.mimeType, metadata.name)) {
    const cat = getConversionCategory(metadata.mimeType, metadata.name);
    if (cat.category === 'pdf') {
      throw new Error('This file is already a PDF in this folder.');
    }
    throw new Error(`This file type (${metadata.mimeType || 'unknown'}) cannot be converted to PDF by Drive PDF Saver. Supported: Google Docs, Sheets, Slides, Drawings, Office files (Word, Excel, PowerPoint), text files, and images.`);
  }

  const fileName = metadata.name || 'Document';
  const pdfName = generatePdfName(fileName);
  log(`Resolved file: "${fileName}" (${metadata.mimeType}), Target PDF: "${pdfName}"`);

  // Step 4: Export or convert to PDF Blob in-memory
  showProgress(tabId, `Exporting "${fileName}" to PDF in memory...`, `Exporting ${fileName}`);
  const pdfBlob = await exportFileToPdf(activeToken, fileId, metadata, (stage, msg) => {
    showProgress(tabId, msg, stage);
  });

  if (!pdfBlob || pdfBlob.size === 0) {
    throw new Error('PDF conversion produced an empty file.');
  }

  // Step 5: Determine same parent folder
  const parentFolderId = (metadata.parents && metadata.parents.length > 0)
    ? metadata.parents[0]
    : null;

  log(`Target folder ID: ${parentFolderId || 'root'}`);

  // Step 6: Check for an existing PDF with the exact same name in that folder
  showProgress(tabId, `Checking for existing "${pdfName}" in folder...`, 'Checking Folder');
  const existingPdf = await findExistingPdf(activeToken, pdfName, parentFolderId);

  // Step 7: Update in-place if existing, or Upload new
  let isUpdate = false;
  if (existingPdf) {
    showProgress(tabId, `Updating existing "${pdfName}" in same folder...`, `Updating ${pdfName}`);
    await updateExistingPdfContent(activeToken, existingPdf.id, pdfBlob);
    isUpdate = true;
    showSuccess(tabId, `✓ "${pdfName}" updated in the same folder.`, 'Drive PDF Saver');
    log(`Successfully updated existing PDF (ID: ${existingPdf.id}) in same folder.`);
  } else {
    showProgress(tabId, `Saving "${pdfName}" to same folder...`, `Uploading ${pdfName}`);
    await uploadNewPdf(activeToken, pdfBlob, pdfName, parentFolderId);
    showSuccess(tabId, `✓ "${pdfName}" saved to the same folder.`, 'Drive PDF Saver');
    log(`Successfully created new PDF "${pdfName}" in same folder.`);
  }

  return { pdfName, isUpdate };
}

