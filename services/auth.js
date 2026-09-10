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
 * Retrieves the profile information of the currently authorized Google Drive account.
 * Uses official drive/v3/about endpoint without requiring additional OAuth scopes.
 * 
 * @param {string} token 
 * @returns {Promise<{ email: string, name: string } | null>}
 */
export async function getAuthorizedUser(token) {
  if (!token) return null;
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      email: data.user?.emailAddress || '',
      name: data.user?.displayName || ''
    };
  } catch (err) {
    log('Failed to fetch authorized user profile:', err);
    return null;
  }
}

/**
 * Manually evicts the current cached token and triggers interactive account re-authorization.
 * Useful for user-driven "Switch Account" workflows in the popup UI.
 * 
 * @returns {Promise<{ token: string, user: { email: string, name: string } | null }>}
 */
export async function invalidateAndReauthorize() {
  log('Triggering manual re-authorization / account switch...');
  try {
    const currentToken = await chrome.identity.getAuthToken({ interactive: false });
    const token = typeof currentToken === 'object' ? currentToken.token : currentToken;
    if (token) {
      await clearAuthToken(token);
    }
  } catch {
    // Ignore if silent token wasn't cached
  }

  const newToken = await getAuthToken(true);
  const user = await getAuthorizedUser(newToken);
  return { token: newToken, user };
}

/**
 * Verifies that the OAuth token can access the specified Google Drive file.
 * If 401, 403, or 404 is encountered (expired token or account mismatch),
 * it evicts the stale cached token and prompts interactive re-authorization ONCE.
 * 
 * @param {string} token Current OAuth access token
 * @param {string} fileId Target Google Drive file ID
 * @param {boolean} [isRetry=false] Whether this is a retry attempt (prevents loops)
 * @returns {Promise<{ metadata: { id: string, name: string, mimeType: string, parents?: string[] }, token: string }>}
 */
export async function verifyCurrentFileAccess(token, fileId, isRetry = false) {
  log(`Verifying file access for ID: ${fileId} (isRetry: ${isRetry})`);
  const fields = 'id,name,mimeType,parents';
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`;

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (netErr) {
    log('Network error verifying file access:', netErr);
    throw new Error('Could not connect to Google Drive. Please check your internet connection.');
  }

  // Handle Token Expiry (401) or Account Access Mismatch (403 / 404)
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    if (!isRetry) {
      log(`Access returned HTTP ${response.status}. Evicting cached token and prompting interactive authorization once...`);
      await clearAuthToken(token);

      let newToken;
      try {
        newToken = await getAuthToken(true);
      } catch (authErr) {
        log('Interactive re-authorization failed:', authErr);
        throw new Error('Google authorization was not granted. Please sign in to authorize Drive PDF Saver.');
      }

      // Retry the access check exactly once with the fresh token
      return await verifyCurrentFileAccess(newToken, fileId, true);
    }

    // If still fails on retry, halt safely with a helpful message identifying the authorized account
    const userInfo = await getAuthorizedUser(token).catch(() => null);
    const accountInfo = userInfo?.email ? ` (${userInfo.email})` : '';

    if (response.status === 401) {
      await clearAuthToken(token);
      throw new Error('Google authorization expired or was revoked. Please click the extension icon to sign in again.');
    }

    log(`File access denied on retry (${response.status}) for account:`, userInfo?.email);
    throw new Error(
      `The Google account currently authorized for Drive PDF Saver${accountInfo} cannot access this file. ` +
      `Please switch to the Google account that owns or has permission to this file, or share the file with ${userInfo?.email || 'your authorized account'}.`
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log(`File access check failed (${response.status}):`, errorBody);
    throw new Error(`Failed to access file on Google Drive (${response.status}).`);
  }

  const metadata = await response.json();
  log(`File access confirmed: "${metadata.name}" (${metadata.mimeType})`);
  return { metadata, token };
}
