// services/drive.js

import { log, sanitizeDriveQuery } from '../utils/helpers.js';
import { clearAuthToken } from './auth.js';

/**
 * Retrieves authoritative metadata for a Google Drive file.
 * @param {string} token OAuth access token
 * @param {string} fileId 
 * @returns {Promise<{ id: string, name: string, mimeType: string, parents?: string[] }>}
 */
export async function getFileMetadata(token, fileId) {
  log(`Fetching metadata for file ID: ${fileId}`);
  const fields = 'id,name,mimeType,parents';
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    await clearAuthToken(token);
    throw new Error('Google authorization expired. Please try again.');
  }

  if (response.status === 404 || response.status === 403) {
    throw new Error('Could not access this file with the authorized Google account. Please ensure the signed-in account has permission.');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log(`Failed to fetch file metadata (${response.status}):`, errorBody);
    throw new Error(`Failed to retrieve file metadata from Google Drive (${response.status}).`);
  }

  const metadata = await response.json();
  log('Metadata retrieved:', metadata);
  return metadata;
}

/**
 * Searches for an existing active PDF with the specified filename in the parent folder.
 * @param {string} token 
 * @param {string} pdfName 
 * @param {string|null} parentFolderId 
 * @returns {Promise<{ id: string, name: string } | null>}
 */
export async function findExistingPdf(token, pdfName, parentFolderId) {
  log(`Checking for existing PDF: "${pdfName}" in folder: ${parentFolderId || 'root'}`);

  const safeName = sanitizeDriveQuery(pdfName);
  const parentClause = parentFolderId ? `'${parentFolderId}' in parents` : `'root' in parents`;
  const q = `${parentClause} and name = '${safeName}' and mimeType = 'application/pdf' and trashed = false`;

  const fields = 'files(id,name,mimeType)';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    log(`Warning: Failed to check for existing PDF (${response.status})`);
    return null;
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    log(`Existing PDF found: ID ${data.files[0].id}`);
    return data.files[0];
  }

  log('No existing PDF found with that name in this folder.');
  return null;
}

/**
 * Uploads a newly exported PDF to the target parent folder using multipart/related upload.
 * @param {string} token 
 * @param {Blob} pdfBlob 
 * @param {string} pdfName 
 * @param {string|null} parentFolderId 
 * @returns {Promise<Object>}
 */
export async function uploadNewPdf(token, pdfBlob, pdfName, parentFolderId) {
  log(`Uploading new PDF "${pdfName}" to parent: ${parentFolderId || 'root'}`);

  const metadata = {
    name: pdfName,
    mimeType: 'application/pdf'
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const boundary = '-------DrivePDFBoundary' + Date.now();

  // RFC 2046 compliant multipart/related body:
  // 1. First part: metadata JSON (starts directly with boundary, NO leading newline)
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  // 2. Second part: binary media header
  const mediaPart = `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
  // 3. Final closing boundary (preceded by newline)
  const closePart = `\r\n--${boundary}--`;

  const multipartBody = new Blob([
    metadataPart,
    mediaPart,
    pdfBlob,
    closePart
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log(`Upload failed (${response.status}):`, errorBody);
    let detail = '';
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed.error?.message ? `: ${parsed.error.message}` : '';
    } catch {
      detail = errorBody ? `: ${errorBody.slice(0, 100)}` : '';
    }
    throw new Error(`Failed to upload PDF to Google Drive (${response.status}${detail}).`);
  }

  const result = await response.json();
  log(`New PDF created successfully. ID: ${result.id}`);
  return result;
}

/**
 * Updates the binary content of an existing PDF file in-place, preserving its ID and location.
 * @param {string} token 
 * @param {string} existingFileId 
 * @param {Blob} pdfBlob 
 * @returns {Promise<Object>}
 */
export async function updateExistingPdfContent(token, existingFileId, pdfBlob) {
  log(`Updating content for existing PDF ID: ${existingFileId}`);

  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=media&supportsAllDrives=true`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/pdf'
    },
    body: pdfBlob
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log(`Update content failed (${response.status}):`, errorBody);
    let detail = '';
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed.error?.message ? `: ${parsed.error.message}` : '';
    } catch {
      detail = errorBody ? `: ${errorBody.slice(0, 100)}` : '';
    }
    throw new Error(`Failed to update existing PDF content on Google Drive (${response.status}${detail}).`);
  }

  const result = await response.json();
  log(`Existing PDF updated successfully. ID: ${result.id}`);
  return result;
}

/**
 * Creates a temporary Google Workspace copy of an uploaded file (DOCX, XLSX, PPTX, TXT, etc.),
 * triggering automatic conversion into Google Docs, Sheets, or Slides format.
 * @param {string} token 
 * @param {string} sourceFileId 
 * @param {string} targetGoogleMimeType 
 * @returns {Promise<{ id: string, name: string }>}
 */
export async function createTempWorkspaceCopy(token, sourceFileId, targetGoogleMimeType) {
  log(`Creating temporary converted copy of file ID: ${sourceFileId} as ${targetGoogleMimeType}`);
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sourceFileId)}/copy?supportsAllDrives=true`;

  const body = {
    name: `.temp_pdf_export_${Date.now()}`,
    mimeType: targetGoogleMimeType
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log(`Temp copy conversion failed (${response.status}):`, errorBody);
    throw new Error(`Google Drive was unable to convert this file to a Workspace document (${response.status}).`);
  }

  const result = await response.json();
  log(`Temporary Workspace copy created with ID: ${result.id}`);
  return result;
}

/**
 * Permanently deletes a file from Google Drive (used for cleaning up temporary conversion files).
 * @param {string} token 
 * @param {string} fileId 
 */
export async function deleteDriveFile(token, fileId) {
  if (!fileId) return;
  log(`Deleting temporary file ID: ${fileId}`);
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      log(`Warning: Failed to delete temp file ${fileId} (${response.status})`);
    } else {
      log(`Temporary file ${fileId} deleted successfully.`);
    }
  } catch (err) {
    log(`Warning: Error deleting temp file ${fileId}:`, err);
  }
}

/**
 * Downloads the raw binary media of a file from Google Drive (e.g. for image conversion).
 * @param {string} token 
 * @param {string} fileId 
 * @returns {Promise<Blob>}
 */
export async function downloadFileMedia(token, fileId) {
  log(`Downloading raw file media for file ID: ${fileId}`);
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log(`Media download failed (${response.status}):`, errorBody);
    throw new Error(`Failed to download file media from Google Drive (${response.status}).`);
  }

  const blob = await response.blob();
  log(`Media downloaded successfully. Size: ${blob.size} bytes`);
  return blob;
}

