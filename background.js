// background.js — Service Worker (ES Module)
// Orchestrates PDF export and conversion directly via official Google Drive API v3.

import { getAuthToken } from './services/auth.js';
import { getFileMetadata, findExistingPdf, uploadNewPdf, updateExistingPdfContent } from './services/drive.js';
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

// Top-level message listener for popup and other extensions components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveAsPdf') {
    log('Save as PDF requested from popup for tab:', message.tabId);
    
    processExportPipeline(message.fileInfo)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true; // Keep message channel open for async response
  }
});

// ============================================================================
// 2. Context Menu Handler
// ============================================================================

async function handleContextMenuAction(tab, pageUrl) {
  try {
    let fileInfo = null;

    // First attempt to extract from tab URL or context menu pageUrl
    const url = tab?.url || pageUrl;
    fileInfo = extractGoogleFileInfo(url);

    // If not directly parsed, query content script in the active tab
    if (!fileInfo && tab?.id) {
      try {
        fileInfo = await chrome.tabs.sendMessage(tab.id, { action: 'getFileInfo' });
      } catch (scriptErr) {
        log('Content script query failed:', scriptErr);
      }
    }

    if (!fileInfo || !fileInfo.fileId) {
      showError('Could not identify the current Google Drive file.');
      return;
    }

    await processExportPipeline(fileInfo);
  } catch (err) {
    log('Context menu processing failed:', err);
    showError(err.message || 'Failed to save PDF to Google Drive.');
  }
}

// ============================================================================
// 3. Core Export Pipeline (Google Drive API)
// ============================================================================

/**
 * Executes the universal Google Drive PDF export/conversion pipeline.
 * @param {{ fileId: string, service?: string }} fileInfo 
 * @returns {Promise<{ pdfName: string, isUpdate: boolean }>}
 */
async function processExportPipeline(fileInfo) {
  if (!fileInfo || !fileInfo.fileId) {
    throw new Error('Could not identify the current Google file.');
  }

  const { fileId } = fileInfo;
  log(`Starting export pipeline for file ID: ${fileId}`);

  // Step 1: Obtain Google OAuth token (cached silent-first, interactive fallback)
  broadcastProgress('Authenticating', 'Connecting to Google Drive...');
  const token = await getAuthToken(true);

  // Step 2: Fetch authoritative file metadata from Drive API
  broadcastProgress('Checking file', 'Retrieving file details...');
  const metadata = await getFileMetadata(token, fileId);

  // Step 3: Verify that the file can be converted to PDF
  if (!isConvertible(metadata.mimeType, metadata.name)) {
    const cat = getConversionCategory(metadata.mimeType, metadata.name);
    if (cat.category === 'pdf') {
      throw new Error('This file is already a PDF in this folder.');
    }
    throw new Error(`This file type (${metadata.mimeType || 'unknown'}) cannot be converted to PDF.`);
  }

  const fileName = metadata.name || 'Document';
  const pdfName = generatePdfName(fileName);
  log(`Resolved file: "${fileName}" (${metadata.mimeType}), Target PDF: "${pdfName}"`);

  // Step 4: Export or convert to PDF Blob in-memory
  showProgress(`Exporting ${fileName}...`);
  broadcastProgress('Exporting', `Exporting "${fileName}" to PDF...`);
  const pdfBlob = await exportFileToPdf(token, fileId, metadata, broadcastProgress);

  if (!pdfBlob || pdfBlob.size === 0) {
    throw new Error('PDF conversion produced an empty file.');
  }

  // Step 5: Determine same parent folder
  const parentFolderId = (metadata.parents && metadata.parents.length > 0)
    ? metadata.parents[0]
    : null;

  log(`Target folder ID: ${parentFolderId || 'root'}`);

  // Step 6: Check for an existing PDF with the exact same name in that folder
  broadcastProgress('Checking folder', `Checking for existing "${pdfName}" in folder...`);
  const existingPdf = await findExistingPdf(token, pdfName, parentFolderId);

  // Step 7: Update in-place if existing, or Upload new
  let isUpdate = false;
  if (existingPdf) {
    showProgress(`Updating ${pdfName}...`);
    broadcastProgress('Updating', `Updating existing "${pdfName}"...`);
    await updateExistingPdfContent(token, existingPdf.id, pdfBlob);
    isUpdate = true;
    showSuccess(`✓ ${pdfName} updated in Google Drive`);
    log(`Successfully updated existing PDF (ID: ${existingPdf.id}) in same folder.`);
  } else {
    showProgress(`Uploading ${pdfName}...`);
    broadcastProgress('Uploading', `Saving "${pdfName}" to same folder...`);
    await uploadNewPdf(token, pdfBlob, pdfName, parentFolderId);
    showSuccess(`✓ ${pdfName} saved to Google Drive`);
    log(`Successfully created new PDF "${pdfName}" in same folder.`);
  }

  return { pdfName, isUpdate };
}

/**
 * Broadcasts progress updates to popup UI if open.
 * @param {string} stage 
 * @param {string} message 
 */
function broadcastProgress(stage, message) {
  chrome.runtime.sendMessage({
    action: 'exportProgress',
    stage,
    message
  }).catch(() => {
    // Popup might not be open; ignore harmless disconnected port
  });
}
