// content.js — Lightweight file detector for Google Drive and Google Workspace

/**
 * Extracts Google Drive or Workspace file ID and service type from URL.
 * @param {string} url 
 * @returns {{ fileId: string, service: string, url: string } | null}
 */
function extractGoogleFileInfo(url) {
  if (!url) return null;

  let service = 'drive-file';
  if (url.includes('/document/')) {
    service = 'docs';
  } else if (url.includes('/spreadsheets/')) {
    service = 'sheets';
  } else if (url.includes('/presentation/')) {
    service = 'slides';
  } else if (url.includes('/drawings/')) {
    service = 'drawings';
  } else if (url.includes('drive.google.com/file/')) {
    service = 'drive-file';
  }

  // Check /d/FILE_ID
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (dMatch && dMatch[1]) {
    return {
      fileId: dMatch[1],
      service: service,
      url: url
    };
  }

  // Check ?id=FILE_ID or &id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch && idMatch[1]) {
    return {
      fileId: idMatch[1],
      service: service,
      url: url
    };
  }

  return null;
}

// Respond to background or popup inquiries
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getFileInfo') {
    const fileInfo = extractGoogleFileInfo(window.location.href);
    sendResponse(fileInfo);
    return false;
  }
});
