// services/file.js

export const GOOGLE_MIME_DOCS = 'application/vnd.google-apps.document';
export const GOOGLE_MIME_SHEETS = 'application/vnd.google-apps.spreadsheet';
export const GOOGLE_MIME_SLIDES = 'application/vnd.google-apps.presentation';
export const GOOGLE_MIME_DRAWINGS = 'application/vnd.google-apps.drawing';

// 1. Native Google Workspace files (exportable directly via files.export)
export const WORKSPACE_EXPORTABLE_MIME_TYPES = {
  [GOOGLE_MIME_DOCS]: { service: 'docs', displayName: 'Google Docs' },
  [GOOGLE_MIME_SHEETS]: { service: 'sheets', displayName: 'Google Sheets' },
  [GOOGLE_MIME_SLIDES]: { service: 'slides', displayName: 'Google Slides' },
  [GOOGLE_MIME_DRAWINGS]: { service: 'drawings', displayName: 'Google Drawings' }
};

// 2. Office & Text formats importable to Google Docs
const DOCS_IMPORTABLE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.oasis.opendocument.text', // .odt
  'application/rtf',
  'text/rtf',
  'text/plain', // .txt
  'text/html',
  'application/xhtml+xml'
]);

// 3. Spreadsheet formats importable to Google Sheets
const SHEETS_IMPORTABLE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'text/csv',
  'text/tab-separated-values'
]);

// 4. Presentation formats importable to Google Slides
const SLIDES_IMPORTABLE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.oasis.opendocument.presentation' // .odp
]);

// 5. Image formats convertible in-memory to PDF
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp'
]);

/**
 * Categorizes a file to determine the best conversion strategy to PDF.
 * @param {string} mimeType 
 * @param {string} [fileName] 
 * @returns {{ category: 'workspace'|'import-docs'|'import-sheets'|'import-slides'|'image'|'pdf'|'unsupported', displayName: string, targetGoogleMimeType?: string }}
 */
export function getConversionCategory(mimeType, fileName = '') {
  const lowerName = fileName.toLowerCase();

  // 1. Native Workspace
  if (WORKSPACE_EXPORTABLE_MIME_TYPES[mimeType]) {
    return {
      category: 'workspace',
      displayName: WORKSPACE_EXPORTABLE_MIME_TYPES[mimeType].displayName
    };
  }

  // 2. Already PDF
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return { category: 'pdf', displayName: 'PDF Document' };
  }

  // 3. Office Docs -> Google Docs
  if (DOCS_IMPORTABLE_MIMES.has(mimeType) || /\.(docx|doc|odt|rtf|txt|html|htm|md|log)$/i.test(lowerName)) {
    return {
      category: 'import-docs',
      targetGoogleMimeType: GOOGLE_MIME_DOCS,
      displayName: lowerName.endsWith('.docx') || lowerName.endsWith('.doc') ? 'Word Document' : 'Text Document'
    };
  }

  // 4. Spreadsheets -> Google Sheets
  if (SHEETS_IMPORTABLE_MIMES.has(mimeType) || /\.(xlsx|xls|ods|csv|tsv)$/i.test(lowerName)) {
    return {
      category: 'import-sheets',
      targetGoogleMimeType: GOOGLE_MIME_SHEETS,
      displayName: lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') ? 'Excel Spreadsheet' : 'Spreadsheet'
    };
  }

  // 5. Presentations -> Google Slides
  if (SLIDES_IMPORTABLE_MIMES.has(mimeType) || /\.(pptx|ppt|odp)$/i.test(lowerName)) {
    return {
      category: 'import-slides',
      targetGoogleMimeType: GOOGLE_MIME_SLIDES,
      displayName: lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt') ? 'PowerPoint Presentation' : 'Presentation'
    };
  }

  // 6. Images -> In-Memory PDF
  if (IMAGE_MIMES.has(mimeType) || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(lowerName)) {
    return {
      category: 'image',
      displayName: 'Image File'
    };
  }

  return {
    category: 'unsupported',
    displayName: mimeType || 'Unknown File'
  };
}

/**
 * Checks if a file is convertible to PDF.
 * @param {string} mimeType 
 * @param {string} [fileName] 
 * @returns {boolean}
 */
export function isConvertible(mimeType, fileName = '') {
  const cat = getConversionCategory(mimeType, fileName);
  return cat.category !== 'unsupported' && cat.category !== 'pdf';
}

/**
 * Extracts Google Drive or Docs file ID and service type from any Drive/Docs URL.
 * Supports:
 * - https://docs.google.com/document/d/FILE_ID/...
 * - https://docs.google.com/spreadsheets/d/FILE_ID/...
 * - https://docs.google.com/presentation/d/FILE_ID/...
 * - https://docs.google.com/drawings/d/FILE_ID/...
 * - https://drive.google.com/file/d/FILE_ID/...
 * - https://drive.google.com/open?id=FILE_ID
 * @param {string} url 
 * @returns {{ fileId: string, service: string } | null}
 */
export function extractGoogleFileInfo(url) {
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
      service: service
    };
  }

  // Check ?id=FILE_ID or &id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch && idMatch[1]) {
    return {
      fileId: idMatch[1],
      service: service
    };
  }

  return null;
}

/**
 * Generates a clean PDF filename from the original document name.
 * Strips common extensions (.docx, .xlsx, .pptx, .png, etc.) and appends .pdf.
 * @param {string} originalName 
 * @returns {string}
 */
export function generatePdfName(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    return 'Untitled.pdf';
  }

  const trimmed = originalName.trim();
  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return trimmed;
  }

  // Remove trailing dots or known extensions
  const cleanBase = trimmed.replace(/\.(gdoc|gsheet|gslides|docx|doc|xlsx|xls|pptx|ppt|odt|ods|odp|rtf|txt|csv|tsv|html|htm|png|jpg|jpeg|webp|gif|bmp)$/i, '');
  return `${cleanBase}.pdf`;
}
