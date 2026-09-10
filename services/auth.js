// services/auth.js

import { log } from '../utils/helpers.js';

/**
 * Obtains an OAuth 2.0 access token using chrome.identity.
 * Tries non-interactive first to prevent unnecessary account prompts on repeat use.
 * Falls back to interactive only when authorization is missing or expired.
 * 
 * @param {boolean} interactiveFallback Whether to trigger interactive consent if silent fails
 * @returns {Promise<string>} Access token
 */
export async function getAuthToken(interactiveFallback = true) {
  // Check if client_id is configured
  const manifest = chrome.runtime.getManifest();
  const clientId = manifest.oauth2?.client_id;
  if (!clientId || clientId.includes('YOUR_CLIENT_ID_HERE')) {
    throw new Error('OAuth Client ID is not configured in manifest.json. Please replace YOUR_CLIENT_ID_HERE with your Google Cloud Client ID.');
  }

  log('Attempting silent auth token acquisition...');
  
  try {
    const silentToken = await chrome.identity.getAuthToken({ interactive: false });
    const token = typeof silentToken === 'object' ? silentToken.token : silentToken;
    if (token) {
      log('Silent auth succeeded.');
      return token;
    }
  } catch (silentErr) {
    log('Silent auth token unavailable:', silentErr.message || silentErr);
  }

  if (!interactiveFallback) {
    throw new Error('Google authorization is required. Please authorize the extension.');
  }

  log('Triggering interactive OAuth authorization...');
  try {
    const interactiveResult = await chrome.identity.getAuthToken({ interactive: true });
    const token = typeof interactiveResult === 'object' ? interactiveResult.token : interactiveResult;
    if (!token) {
      throw new Error('No token returned from Google authorization.');
    }
    log('Interactive authorization succeeded.');
    return token;
  } catch (err) {
    log('Interactive authorization failed:', err);
    const detail = err?.message ? `: ${err.message}` : '';
    throw new Error(`Google authorization was not granted${detail}. Please ensure you are signed into Chrome and approve access to Google Drive.`);
  }
}

/**
 * Removes a cached, expired, or invalid auth token.
 * @param {string} token 
 */
export async function clearAuthToken(token) {
  if (!token) return;
  try {
    await chrome.identity.removeCachedAuthToken({ token });
    log('Cached auth token removed successfully.');
  } catch (err) {
    log('Error clearing cached auth token:', err);
  }
}

/**
 * Verifies that the current OAuth token has access to the specified Google Drive file.
 * Catches multi-account mismatch issues before attempting export operations.
 * 
 * @param {string} token OAuth access token
 * @param {string} fileId Google Drive file ID
 * @returns {Promise<{ id: string, name: string, mimeType: string, parents?: string[] }>}
 */
export async function verifyCurrentFileAccess(token, fileId) {
  log(`Verifying access permissions for file ID: ${fileId}`);
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
    throw new Error('Google authorization expired. Please try again to refresh your session.');
  }

  if (response.status === 403 || response.status === 404) {
    throw new Error(
      'Account mismatch / permission error: Your signed-in Chrome Google account does not have permission to access this file. ' +
      'If you have multiple Google accounts, please ensure this file is shared with your Chrome profile account or switch to the corresponding Chrome profile.'
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log(`File access check failed (${response.status}):`, errorBody);
    throw new Error(`Failed to access file on Google Drive (${response.status}).`);
  }

  const metadata = await response.json();
  log(`File access verified for: "${metadata.name}" (${metadata.mimeType})`);
  return metadata;
}
