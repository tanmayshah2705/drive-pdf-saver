// utils/helpers.js

export const DEBUG = true;

/**
 * Log message with standardized extension prefix.
 * @param  {...any} args 
 */
export function log(...args) {
  if (DEBUG) {
    console.log('[DrivePDF]', ...args);
  }
}

/**
 * Escapes characters in strings used within Google Drive search queries.
 * @param {string} str 
 * @returns {string}
 */
export function sanitizeDriveQuery(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
