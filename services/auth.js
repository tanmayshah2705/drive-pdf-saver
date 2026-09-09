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
    throw new Error(`Google authorization was not granted${detail}. Please ensure you are signed into Chrome and your account is added as a Test User.`);
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
