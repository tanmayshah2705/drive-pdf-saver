// services/auth.js
// Multi-account aware auth helpers for Drive PDF Saver.
// Token acquisition is delegated to services/accounts.js (PKCE + launchWebAuthFlow).
// This module provides the account-routing logic used by the export pipeline.

import { log } from '../utils/helpers.js';
import {
  getTokenForAccount,
  getConnectedAccountEmails,
  evictToken,
  getAccountIndexMap,
  saveAccountIndexMap
} from './accounts.js';

// ---------------------------------------------------------------------------
// resolveTokenForTab
// ---------------------------------------------------------------------------

/**
 * Resolves the correct access token for the active Drive tab.
 *
 * Resolution order:
 *   1. If a specific email was detected from the tab (in-page DOM or URL),
 *      and that account is connected, route directly to it and update the
 *      session index mapping. If detected but not connected, hard fail (never fall back).
 *   2. If no email detected, but a userIndex is present (/u/N/ or authuser=N),
 *      check the validated session index mapping.
 *   3. If only one account is connected, use it (unambiguous).
 *   4. Otherwise throw -- the caller must surface a "cannot determine account" error.
 *
 * Invariant: We NEVER fall back silently to a different account's token.
 *
 * @param {{ email?: string|null, userIndex?: number|null }} activeAccountHint
 * @returns {Promise<{ token: string, email: string }>}
 */
export async function resolveTokenForTab(activeAccountHint) {
  const hintEmail = activeAccountHint && activeAccountHint.email
    ? activeAccountHint.email.toLowerCase().trim()
    : null;

  const rawIndex = activeAccountHint && activeAccountHint.userIndex !== undefined && activeAccountHint.userIndex !== null
    ? String(activeAccountHint.userIndex)
    : null;

  const connectedEmails = await getConnectedAccountEmails();

  if (connectedEmails.length === 0) {
    throw new Error(
      'No Google accounts are connected to Drive PDF Saver. ' +
      'Please open the extension popup and connect your Google account first.'
    );
  }

  // Case 1: exact match on detected email
  if (hintEmail) {
    const matched = connectedEmails.find(function(e) {
      return e.toLowerCase() === hintEmail;
    });
    if (matched) {
      log('Routing to connected account matching active email: ' + matched);
      if (rawIndex !== null) {
        await saveAccountIndexMap(rawIndex, matched);
      }
      const token = await getTokenForAccount(matched);
      return { token, email: matched };
    }

    // Email detected in tab but NOT connected -- hard fail, do not fall back
    throw new Error(
      'The active Google Drive account (' + hintEmail + ') is not connected to Drive PDF Saver. ' +
      'Please open the extension popup and connect this account.'
    );
  }

  // Case 2: check validated session index mapping (/u/N/ or authuser=N)
  if (rawIndex !== null) {
    const indexMap = await getAccountIndexMap();
    const mappedEmail = indexMap[rawIndex];
    if (mappedEmail) {
      const matched = connectedEmails.find(function(e) {
        return e.toLowerCase() === mappedEmail.toLowerCase();
      });
      if (matched) {
        log('Routing to validated account for /u/' + rawIndex + ': ' + matched);
        const token = await getTokenForAccount(matched);
        return { token, email: matched };
      }
    }
  }

  // Case 3: no hint but exactly one account connected -- unambiguous
  if (connectedEmails.length === 1) {
    const email = connectedEmails[0];
    log('No account hint; using the only connected account: ' + email);
    if (rawIndex !== null) {
      await saveAccountIndexMap(rawIndex, email);
    }
    const token = await getTokenForAccount(email);
    return { token, email };
  }

  // Case 4: multiple accounts connected, no hint and no mapping -- ambiguous, must fail safely
  throw new Error(
    'Multiple Google accounts are connected and the active account could not be determined. ' +
    'Please switch to the Google Drive tab for the account you want to use.'
  );
}

// ---------------------------------------------------------------------------
// clearAuthToken
// ---------------------------------------------------------------------------

/**
 * Removes a cached, expired, or invalid auth token from session cache and
 * chrome.identity cache.
 * @param {string} token Access token to clear
 */
export async function clearAuthToken(token) {
  if (!token) return;
  try {
    await evictToken(token);
    log('Cleared auth token from cache.');
  } catch (err) {
    log('Error clearing auth token:', err);
  }
}


// ---------------------------------------------------------------------------
// getAuthorizedUser  (kept for popup compatibility)
// ---------------------------------------------------------------------------

/**
 * Retrieves Google Drive profile information for an access token.
 * @param {string} token
 * @returns {Promise<{ email: string, name: string } | null>}
 */
export async function getAuthorizedUser(token) {
  if (!token) return null;
  try {
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return {
      email: (data.user && data.user.emailAddress) || '',
      name:  (data.user && data.user.displayName)  || '',
    };
  } catch (err) {
    log('Failed to fetch authorized user profile:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// verifyCurrentFileAccess
// ---------------------------------------------------------------------------

/**
 * Verifies that the given token can access the specified Drive file.
 * On 401 the token is considered expired -- caller should re-auth and retry.
 * On 403/404 it is an account mismatch -- throws a descriptive error.
 *
 * @param {string} token    Access token
 * @param {string} fileId   Google Drive file ID
 * @param {boolean} [isRetry=false]  Whether this is a retry (prevents infinite loops)
 * @returns {Promise<{ metadata: Object, token: string }>}
 */
export async function verifyCurrentFileAccess(token, fileId, isRetry) {
  if (isRetry === undefined) isRetry = false;
  log('Verifying file access for ID: ' + fileId + ' (isRetry: ' + isRetry + ')');

  const fields = 'id,name,mimeType,parents';
  const url = 'https://www.googleapis.com/drive/v3/files/' +
    encodeURIComponent(fileId) +
    '?fields=' + encodeURIComponent(fields) +
    '&supportsAllDrives=true';

  let response;
  try {
    response = await fetch(url, {
      method:  'GET',
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch (netErr) {
    log('Network error verifying file access:', netErr);
    throw new Error('Could not connect to Google Drive. Please check your internet connection.');
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    const userInfo = await getAuthorizedUser(token).catch(function() { return null; });
    const accountInfo = (userInfo && userInfo.email) ? ' (' + userInfo.email + ')' : '';

    if (response.status === 401) {
      throw new Error('Google authorization expired. Please reconnect the account from the extension popup.');
    }

    log('File access denied (' + response.status + ') for account:', userInfo && userInfo.email);
    throw new Error(
      'The connected Google account' + accountInfo + ' cannot access this file. ' +
      'Make sure you are viewing the file while signed in as the account that has access to it.'
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(function() { return ''; });
    log('File access check failed (' + response.status + '):', errorBody);
    throw new Error('Failed to access file on Google Drive (' + response.status + ').');
  }

  const metadata = await response.json();
  log('File access confirmed: "' + metadata.name + '" (' + metadata.mimeType + ')');
  return { metadata, token };
}
