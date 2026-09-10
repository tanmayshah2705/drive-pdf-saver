// services/export.js

import { log } from '../utils/helpers.js';
import { clearAuthToken } from './auth.js';
import { getConversionCategory } from './file.js';
import { createTempWorkspaceCopy, deleteDriveFile, downloadFileMedia } from './drive.js';

/**
 * Exports a native Google Workspace file as a PDF Blob using Drive API v3 files.export.
 * @param {string} token OAuth access token
 * @param {string} fileId Google Drive file ID
 * @returns {Promise<Blob>} In-memory PDF Blob
 */
export async function exportWorkspaceFileToPdf(token, fileId) {
  log(`Requesting PDF export for Workspace file ID: ${fileId}`);
  const exportUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`;

  const response = await fetch(exportUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    await clearAuthToken(token);
    throw new Error('Google authorization expired. Please try again to re-authorize.');
  }

  if (response.status === 404 || response.status === 403) {
    throw new Error('Could not access or export this file with the authorized Google account.');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log(`Export failed with HTTP ${response.status}:`, errorBody);
    throw new Error(`Google Drive API export failed (${response.status}): ${response.statusText}`);
  }

  const pdfBlob = await response.blob();
  log(`PDF export complete. Blob size: ${pdfBlob.size} bytes`);
  return pdfBlob;
}

/**
 * Converts any supported file (Google Workspace, Office, Text, Image) to a PDF Blob.
 * Uses official Google cloud conversion for Office/Text documents, and native in-memory
 * conversion for images.
 * 
 * @param {string} token 
 * @param {string} fileId 
 * @param {{ name: string, mimeType: string }} metadata 
 * @param {(stage: string, message: string) => void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function exportFileToPdf(token, fileId, metadata, onProgress = () => {}) {
  const categoryInfo = getConversionCategory(metadata.mimeType, metadata.name);
  log(`Exporting file "${metadata.name}" via strategy: ${categoryInfo.category}`);

  // 1. Native Workspace document (Google Docs, Sheets, Slides, Drawings)
  if (categoryInfo.category === 'workspace') {
    return await exportWorkspaceFileToPdf(token, fileId);
  }

  // 2. Already a PDF
  if (categoryInfo.category === 'pdf') {
    throw new Error('This file is already a PDF in this folder.');
  }

  // 3. Office / Text document (Word, Excel, PowerPoint, Text, RTF, HTML, CSV)
  if (categoryInfo.category.startsWith('import-')) {
    onProgress('Converting', `Converting ${metadata.name} via Google Drive...`);
    const tempCopy = await createTempWorkspaceCopy(token, fileId, categoryInfo.targetGoogleMimeType);

    try {
      onProgress('Exporting', `Exporting converted ${metadata.name} to PDF...`);
      return await exportWorkspaceFileToPdf(token, tempCopy.id);
    } finally {
      // Always delete temporary Google Doc so user's Drive stays clean
      await deleteDriveFile(token, tempCopy.id);
    }
  }

  // 4. Image file (PNG, JPG, WebP, GIF, BMP)
  if (categoryInfo.category === 'image') {
    onProgress('Downloading', `Reading image ${metadata.name}...`);
    const imageBlob = await downloadFileMedia(token, fileId);

    onProgress('Converting', `Converting image to PDF...`);
    return await convertImageToPdf(imageBlob);
  }

  throw new Error(`This file type (${metadata.mimeType || 'unknown'}) cannot be converted to PDF by Drive PDF Saver. Supported: Google Docs, Sheets, Slides, Drawings, Office files (Word, Excel, PowerPoint), text files, and images.`);
}

/**
 * Converts an image Blob (JPEG, PNG, WebP, GIF, BMP) to a valid PDF Blob in memory.
 * Uses OffscreenCanvas and native JPEG DCTDecode streams.
 * @param {Blob} imageBlob 
 * @returns {Promise<Blob>}
 */
export async function convertImageToPdf(imageBlob) {
  log(`Converting image Blob (type: ${imageBlob.type}, size: ${imageBlob.size}) to PDF`);

  const bitmap = await createImageBitmap(imageBlob);
  const width = bitmap.width;
  const height = bitmap.height;

  let jpegBlob;
  if (imageBlob.type === 'image/jpeg' || imageBlob.type === 'image/jpg') {
    jpegBlob = imageBlob;
  } else {
    // Render to OffscreenCanvas with white background for transparency handling
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
    jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
  }

  bitmap.close();
  return await wrapJpegInPdf(jpegBlob, width, height);
}

/**
 * Wraps raw JPEG binary data inside an RFC-compliant single-page PDF document.
 * @param {Blob} jpegBlob 
 * @param {number} width 
 * @param {number} height 
 * @returns {Promise<Blob>}
 */
async function wrapJpegInPdf(jpegBlob, width, height) {
  const jpegArrayBuffer = await jpegBlob.arrayBuffer();
  const jpegBytes = new Uint8Array(jpegArrayBuffer);

  const w = width;
  const h = height;

  const header = '%PDF-1.4\n';
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const obj4Trailer = '\nendstream\nendobj\n';
  const contentStream = `q\n${w} 0 0 ${h} 0 0 cm\n/Im1 Do\nQ\n`;
  const obj5 = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`;

  const enc = new TextEncoder();
  const hBytes = enc.encode(header);
  const o1Bytes = enc.encode(obj1);
  const o2Bytes = enc.encode(obj2);
  const o3Bytes = enc.encode(obj3);
  const o4HBytes = enc.encode(obj4Header);
  const o4TBytes = enc.encode(obj4Trailer);
  const o5Bytes = enc.encode(obj5);

  const offset1 = hBytes.length;
  const offset2 = offset1 + o1Bytes.length;
  const offset3 = offset2 + o2Bytes.length;
  const offset4 = offset3 + o3Bytes.length;
  const offset5 = offset4 + o4HBytes.length + jpegBytes.length + o4TBytes.length;
  const xrefOffset = offset5 + o5Bytes.length;

  const pad = (n) => String(n).padStart(10, '0');
  const xref = `xref\n0 6\n0000000000 65535 f \n${pad(offset1)} 00000 n \n${pad(offset2)} 00000 n \n${pad(offset3)} 00000 n \n${pad(offset4)} 00000 n \n${pad(offset5)} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const trailerBytes = enc.encode(xref + trailer);

  return new Blob([
    hBytes,
    o1Bytes,
    o2Bytes,
    o3Bytes,
    o4HBytes,
    jpegBytes,
    o4TBytes,
    o5Bytes,
    trailerBytes
  ], { type: 'application/pdf' });
}
