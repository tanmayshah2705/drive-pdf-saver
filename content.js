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

  if (message.action === 'showToast') {
    renderToast(message.type || 'progress', message.title || 'Drive PDF Saver', message.message || '');
    sendResponse({ received: true });
    return false;
  }
});

// ============================================================================
// In-Page Toast Notification System (Shadow DOM)
// ============================================================================

let toastHost = null;
let toastShadow = null;
let dismissTimer = null;

function ensureToastContainer() {
  if (toastHost && toastHost.isConnected && toastShadow) {
    return toastShadow;
  }

  // Remove stale host if present
  const oldHost = document.getElementById('drive-pdf-saver-toast-host');
  if (oldHost) oldHost.remove();

  toastHost = document.createElement('div');
  toastHost.id = 'drive-pdf-saver-toast-host';
  toastHost.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; pointer-events: none;';
  (document.body || document.documentElement).appendChild(toastHost);

  toastShadow = toastHost.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .toast-card {
      pointer-events: auto;
      background: #ffffff;
      color: #202124;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.16), 0 1px 4px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: 12px 16px;
      min-width: 280px;
      max-width: 380px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-sizing: border-box;
      transform: translateY(16px);
      opacity: 0;
      transition: transform 0.22s cubic-bezier(0.2, 0, 0.13, 1.5), opacity 0.2s ease-out;
    }

    .toast-card.show {
      transform: translateY(0);
      opacity: 1;
    }

    .toast-card.hide {
      transform: translateY(16px);
      opacity: 0;
      pointer-events: none;
    }

    .toast-icon {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2.5px solid #e8f0fe;
      border-top-color: #1a73e8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .toast-body {
      flex: 1;
      min-width: 0;
    }

    .toast-title {
      font-size: 13.5px;
      font-weight: 600;
      color: #202124;
      line-height: 1.35;
      margin-bottom: 2px;
    }

    .toast-msg {
      font-size: 12px;
      color: #5f6368;
      line-height: 1.4;
      word-break: break-word;
    }

    .toast-close {
      background: none;
      border: none;
      color: #80868b;
      cursor: pointer;
      padding: 2px 4px;
      font-size: 16px;
      line-height: 1;
      border-radius: 4px;
      transition: background-color 0.15s, color 0.15s;
    }

    .toast-close:hover {
      background-color: #f1f3f4;
      color: #202124;
    }
  `;

  toastShadow.appendChild(style);
  return toastShadow;
}

/**
 * Renders an in-page toast notification.
 * @param {'progress'|'success'|'error'} type 
 * @param {string} title 
 * @param {string} message 
 */
function renderToast(type, title, message) {
  const shadow = ensureToastContainer();
  clearTimeout(dismissTimer);

  let card = shadow.querySelector('.toast-card');
  if (!card) {
    card = document.createElement('div');
    card.className = 'toast-card';
    card.innerHTML = `
      <div class="toast-icon"></div>
      <div class="toast-body">
        <div class="toast-title"></div>
        <div class="toast-msg"></div>
      </div>
      <button class="toast-close" title="Dismiss">&times;</button>
    `;

    card.querySelector('.toast-close').addEventListener('click', () => {
      dismissToast(card);
    });

    shadow.appendChild(card);
  }

  const iconEl = card.querySelector('.toast-icon');
  const titleEl = card.querySelector('.toast-title');
  const msgEl = card.querySelector('.toast-msg');

  titleEl.textContent = title;
  msgEl.textContent = message;

  if (type === 'progress') {
    iconEl.innerHTML = '<div class="spinner"></div>';
  } else if (type === 'success') {
    iconEl.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#e6f4ea"/>
        <path d="M7 12.5L10.5 16L17 8.5" stroke="#137333" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  } else {
    // error
    iconEl.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#fce8e6"/>
        <path d="M12 7V13M12 16.5V17" stroke="#c5221f" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
    `;
  }

  // Trigger animation
  requestAnimationFrame(() => {
    card.classList.remove('hide');
    card.classList.add('show');
  });

  // Auto dismiss for success / error
  if (type === 'success') {
    dismissTimer = setTimeout(() => dismissToast(card), 4500);
  } else if (type === 'error') {
    dismissTimer = setTimeout(() => dismissToast(card), 7000);
  }
}

function dismissToast(card) {
  if (!card) return;
  card.classList.remove('show');
  card.classList.add('hide');
}
