// services/accounts.js
// Multi-account registry and PKCE-based OAuth flow.
// Account identities stored in chrome.storage.local (persistent).
// Access tokens stored ONLY in chrome.storage.session (ephemeral, wiped on Chrome close).

import { log } from '../utils/helpers.js';

// -- Storage keys -------------------------------------------------------------
const REGISTRY_KEY   = 'drive_pdf_accounts';         // [{email, displayName, connectedAt}] in chrome.storage.local
const TOKEN_KEY      = 'drive_pdf_tokens';           // {[email]: {accessToken, expiresAt}} in chrome.storage.session
const INDEX_MAP_KEY  = 'drive_pdf_account_index_map'; // {[userIndex]: email} in chrome.storage.session

// -- OAuth constants ----------------------------------------------------------
const WEB_CLIENT_ID  = '48459272093-0kkpphs9kh70jbd3vnvl33l5qb8okdmi.apps.googleusercontent.com';
const REDIRECT_URI   = typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL
  ? chrome.identity.getRedirectURL()
  : 'https://aijdgafbjdkfalbceioihafdkepiikce.chromiumapp.org/';
const DRIVE_SCOPE    = 'https://www.googleapis.com/auth/drive';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// -- PKCE helpers -------------------------------------------------------------

/**
 * Generates a cryptographically random PKCE code verifier (43-128 chars, URL-safe).
 * @returns {string}
 */
function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Derives the PKCE S256 code challenge from a code verifier.
 * @param {string} verifier
 * @returns {Promise<string>}
 */
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// -- Registry helpers ---------------------------------------------------------

/**
 * Returns the list of connected account identities (no tokens).
 * @returns {Promise<Array<{email:string, displayName:string, connectedAt:string}>>}
 */
export async function getConnectedAccounts() {
  const result = await chrome.storage.local.get(REGISTRY_KEY);
  return result[REGISTRY_KEY] || [];
}

/**
 * Returns an array of connected email strings.
 * @returns {Promise<string[]>}
 */
export async function getConnectedAccountEmails() {
  const accounts = await getConnectedAccounts();
  return accounts.map(a => a.email);
}

/**
 * Saves the account registry to local storage (identities only, never tokens).
 * @param {Array<{email:string, displayName:string, connectedAt:string}>} accounts
 */
async function saveRegistry(accounts) {
  await chrome.storage.local.set({ [REGISTRY_KEY]: accounts });
}

// -- Token cache (session-only) -----------------------------------------------

/**
 * Reads the in-session token cache.
 * @returns {Promise<Object>} map of email => {accessToken, expiresAt}
 */
async function readTokenCache() {
  try {
    const result = await chrome.storage.session.get(TOKEN_KEY);
    return result[TOKEN_KEY] || {};
  } catch {
    return {};
  }
}

/**
 * Writes (merges) a token entry for one email into the session token cache.
 * @param {string} email
 * @param {{accessToken:string, expiresAt:number}} entry
 */
async function writeTokenCache(email, entry) {
  const cache = await readTokenCache();
  cache[email] = entry;
  await chrome.storage.session.set({ [TOKEN_KEY]: cache });
}

/**
 * Removes a token entry from the session cache by email or by matching access token value.
 * Also removes from chrome.identity cache if present.
 * @param {string} tokenOrEmail
 */
export async function evictToken(tokenOrEmail) {
  if (!tokenOrEmail) return;
  try {
    const cache = await readTokenCache();
    let modified = false;

    // Direct match on email key
    if (cache[tokenOrEmail]) {
      delete cache[tokenOrEmail];
      modified = true;
      log('Evicted session token for account: ' + tokenOrEmail);
    }

    // Search by access token value
    for (const key of Object.keys(cache)) {
      if (cache[key] && cache[key].accessToken === tokenOrEmail) {
        delete cache[key];
        modified = true;
        log('Evicted session token matching access token for account: ' + key);
      }
    }

    if (modified) {
      await chrome.storage.session.set({ [TOKEN_KEY]: cache });
    }
  } catch (err) {
    log('Error evicting token from session cache:', err);
  }

  // Also remove from chrome.identity cache if present
  if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.removeCachedAuthToken) {
    try {
      await chrome.identity.removeCachedAuthToken({ token: tokenOrEmail });
      log('Removed token from chrome.identity cache.');
    } catch {
      // Ignore if not present in chrome.identity cache
    }
  }
}

// -- Token acquisition --------------------------------------------------------

/**
 * Exchanges an authorization code for an access token using PKCE.
 * No client_secret is sent -- PKCE is the proof of possession.
 *
 * @param {string} code        Authorization code from launchWebAuthFlow redirect
 * @param {string} verifier    Original PKCE code verifier
 * @returns {Promise<{accessToken:string, expiresAt:number}>}
 */
async function exchangeCodeForToken(code, verifier) {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code:          code,
    redirect_uri:  REDIRECT_URI,
    client_id:     WEB_CLIENT_ID,
    code_verifier: verifier,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error('Token exchange failed (' + response.status + ').');
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('No access_token in token endpoint response.');
  }

  const expiresAt = Date.now() + (data.expires_in || 3600) * 1000 - 60000; // 1 min buffer
  return { accessToken: data.access_token, expiresAt };
}

/**
 * Fetches the Google Drive account info for a given access token.
 * @param {string} accessToken
 * @returns {Promise<{email:string, displayName:string}>}
 */
async function fetchAccountInfo(accessToken) {
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  if (!response.ok) {
    throw new Error('Could not verify account (' + response.status + ').');
  }
  const data = await response.json();
  const email = data.user && data.user.emailAddress;
  if (!email) throw new Error('Google account verification returned no email address.');
  return { email, displayName: (data.user && data.user.displayName) || email };
}

// -- Public account management ------------------------------------------------

/**
 * Launches launchWebAuthFlow with PKCE to connect a Google account.
 * The user can choose which account to authorize (Google account picker).
 * After success, stores identity in local storage and token in session storage.
 *
 * @param {string} [loginHint]  Optional email hint to pre-select in Google's picker
 * @returns {Promise<{email:string, displayName:string}>} The newly connected account
 */
export async function connectAccount(loginHint) {
  const authParams = new URLSearchParams({
    response_type: 'token',
    client_id:     WEB_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         DRIVE_SCOPE,
    prompt:        'select_account',
  });

  if (loginHint) {
    authParams.set('login_hint', loginHint);
  }

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + authParams.toString();

  log('Launching OAuth flow via launchWebAuthFlow...');
  let redirectUrl;
  try {
    redirectUrl = await chrome.identity.launchWebAuthFlow({
      url:         authUrl,
      interactive: true,
    });
  } catch (err) {
    throw new Error('Authorization was cancelled or failed: ' + ((err && err.message) ? err.message : err));
  }

  if (!redirectUrl) {
    throw new Error('Authorization was cancelled (no redirect URL received).');
  }

  // Parse redirect URL for access_token (hash fragment or query params)
  let accessToken = null;
  let expiresIn = 3600;

  // 1. Check hash fragment (#access_token=...&expires_in=...)
  if (redirectUrl.includes('#')) {
    const hash = redirectUrl.substring(redirectUrl.indexOf('#') + 1);
    const hashParams = new URLSearchParams(hash);
    if (hashParams.has('access_token')) {
      accessToken = hashParams.get('access_token');
    }
    if (hashParams.has('expires_in')) {
      const exp = parseInt(hashParams.get('expires_in'), 10);
      if (!isNaN(exp) && exp > 0) expiresIn = exp;
    }
    const hashError = hashParams.get('error');
    if (hashError) {
      throw new Error('Google authorization denied: ' + hashError);
    }
  }

  // 2. Check query params (?access_token=... or ?error=...)
  try {
    const redirectParsed = new URL(redirectUrl);
    const queryError = redirectParsed.searchParams.get('error');
    if (queryError) {
      throw new Error('Google authorization denied: ' + queryError);
    }
    if (!accessToken && redirectParsed.searchParams.has('access_token')) {
      accessToken = redirectParsed.searchParams.get('access_token');
      const exp = parseInt(redirectParsed.searchParams.get('expires_in'), 10);
      if (!isNaN(exp) && exp > 0) expiresIn = exp;
    }
    // 3. Fallback: if authorization code was returned instead
    if (!accessToken && redirectParsed.searchParams.has('code')) {
      const code = redirectParsed.searchParams.get('code');
      const tokenEntry = await exchangeCodeForToken(code, '');
      accessToken = tokenEntry.accessToken;
      expiresIn = Math.max(60, Math.round((tokenEntry.expiresAt - Date.now()) / 1000));
    }
  } catch (urlErr) {
    if (!accessToken) throw urlErr;
  }

  if (!accessToken) {
    throw new Error('No access token received from Google authorization.');
  }

  const expiresAt = Date.now() + expiresIn * 1000 - 60000; // 1 min buffer
  const tokenEntry = { accessToken, expiresAt };

  // Fetch account identity to confirm who authorized
  const accountInfo = await fetchAccountInfo(tokenEntry.accessToken);

  // Persist identity (not token) in local storage
  const accounts = await getConnectedAccounts();
  const existingIdx = accounts.findIndex(function(a) {
    return a.email.toLowerCase() === accountInfo.email.toLowerCase();
  });
  const record = {
    email:       accountInfo.email,
    displayName: accountInfo.displayName,
    connectedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    accounts[existingIdx] = record;
  } else {
    accounts.push(record);
  }
  await saveRegistry(accounts);
  log('Saved account to local registry: ' + accountInfo.email);

  // Cache token in session storage only
  await writeTokenCache(accountInfo.email, tokenEntry);
  log('Cached token in session storage for: ' + accountInfo.email);

  return accountInfo;
}

// -- Session Index Mapping helpers --------------------------------------------

/**
 * Returns the current validated map of Google userIndex -> email from session storage.
 * @returns {Promise<Object>} map of string(userIndex) => email
 */
export async function getAccountIndexMap() {
  try {
    const result = await chrome.storage.session.get(INDEX_MAP_KEY);
    return result[INDEX_MAP_KEY] || {};
  } catch {
    return {};
  }
}

/**
 * Records a validated mapping between a Google userIndex (e.g. 0, 1) and an authorized email.
 * Stored only in session storage.
 * @param {number|string} userIndex
 * @param {string} email
 */
export async function saveAccountIndexMap(userIndex, email) {
  if (userIndex === null || userIndex === undefined || !email) return;
  try {
    const map = await getAccountIndexMap();
    map[String(userIndex)] = email.trim();
    await chrome.storage.session.set({ [INDEX_MAP_KEY]: map });
    log('Saved session index mapping: /u/' + userIndex + ' => ' + email);
  } catch (err) {
    log('Failed to save account index map:', err);
  }
}

/**
 * Disconnects a Google account: removes from registry and evicts session token.
 * Also cleans up any session index mapping for this email.
 * @param {string} email
 */
export async function disconnectAccount(email) {
  const accounts = await getConnectedAccounts();
  const filtered = accounts.filter(function(a) { return a.email.toLowerCase() !== email.toLowerCase(); });
  await saveRegistry(filtered);
  await evictToken(email);

  // Clean up index mapping for this email
  try {
    const map = await getAccountIndexMap();
    let modified = false;
    for (const [idx, mappedEmail] of Object.entries(map)) {
      if (mappedEmail.toLowerCase() === email.toLowerCase()) {
        delete map[idx];
        modified = true;
      }
    }
    if (modified) {
      await chrome.storage.session.set({ [INDEX_MAP_KEY]: map });
    }
  } catch {
    // Ignore cleanup error
  }

  log('Account disconnected: ' + email);
}

/**
 * Returns a valid access token for the given email.
 * Checks the session cache first; if expired or missing, triggers interactive
 * re-authorization (login_hint pre-selects the correct account in the picker).
 *
 * @param {string} email  The email address of the connected account
 * @returns {Promise<string>}  A valid access token
 * @throws {Error} If the account is not connected or re-authorization fails
 */
export async function getTokenForAccount(email) {
  // Ensure account is in the registry
  const emails = await getConnectedAccountEmails();
  if (!emails.includes(email)) {
    throw new Error(
      'Account ' + email + ' is not connected to Drive PDF Saver. ' +
      'Please open the extension popup and connect this account first.'
    );
  }

  // Check session token cache
  const cache = await readTokenCache();
  const entry = cache[email];
  if (entry && entry.accessToken && Date.now() < entry.expiresAt) {
    log('Using cached token for ' + email + ' (expires in ' + Math.round((entry.expiresAt - Date.now()) / 60000) + ' min).');
    return entry.accessToken;
  }

  // Token expired or not cached -- trigger interactive re-auth for this specific account
  log('Token for ' + email + ' expired or missing. Re-authorizing interactively...');
  await connectAccount(email); // loginHint = email to pre-select this account

  // Read fresh token from cache
  const freshCache = await readTokenCache();
  const freshEntry = freshCache[email];
  if (!freshEntry || !freshEntry.accessToken) {
    throw new Error('Re-authorization for ' + email + ' did not produce a valid token.');
  }

  return freshEntry.accessToken;
}
