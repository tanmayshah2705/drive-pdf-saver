# Drive PDF Saver

A Chrome Extension (Manifest V3) that converts any active Google Doc, Sheet, Slide, Office file, or image to PDF and saves it directly into the **same Google Drive folder** as the original — in one right-click.

## ⬇️ Download

**[⬇️ Download Drive PDF Saver v1.0.0](https://github.com/tanmayshah2705/drive-pdf-saver/releases/download/v1.0.0/Drive-PDF-Saver-v1.0.0.zip)**

> Direct link to the ready-to-use extension ZIP — extract and load unpacked in Chrome. See [Installation](#installation) for step-by-step instructions.
>
> 🌐 **[Landing Page](https://tanmayshah2705.github.io/drive-pdf-saver/)** &nbsp;·&nbsp; 📦 **[All Releases](https://github.com/tanmayshah2705/drive-pdf-saver/releases)** &nbsp;·&nbsp; 📄 **[Release Notes v1.0.0](https://github.com/tanmayshah2705/drive-pdf-saver/releases/tag/v1.0.0)**

---

> **Distribution:** This extension is not on the Chrome Web Store. Download the release ZIP from GitHub and load it unpacked in Developer mode.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Supported Formats](#supported-formats)
4. [How It Works](#how-it-works)
5. [Installation](#installation)
6. [First-Time Google Account Setup](#first-time-google-account-setup)
7. [Multiple-Account Usage](#multiple-account-usage)
8. [Saving and Updating PDFs](#saving-and-updating-pdfs)
9. [Permissions Explained](#permissions-explained)
10. [Privacy and Security](#privacy-and-security)
11. [OAuth Testing Mode and Test User Requirement](#oauth-testing-mode-and-test-user-requirement)
12. [7-Day Token Limitation](#7-day-token-limitation)
13. [Troubleshooting](#troubleshooting)
14. [Project Structure](#project-structure)
15. [Development and Testing](#development-and-testing)
16. [License](#license)

---

## Overview

Drive PDF Saver adds a "Save as PDF to Google Drive" context menu item to every supported Google Drive and Google Workspace URL. When triggered, it:

1. Detects which Google account is active in the current browser tab.
2. Fetches the file's metadata from Google Drive API.
3. Converts the file to PDF entirely via official Google APIs (no third-party server).
4. Saves the resulting PDF to the **same Drive folder** as the original, updating an existing same-name PDF in place.

The extension supports multiple connected Google accounts simultaneously — each Drive tab routes to the correct account's authorization, never another's.

---

## Features

- **One-click export** — right-click any supported file and select *Save as PDF to Google Drive*.
- **Same-folder guarantee** — the PDF is always saved alongside the original in Drive.
- **Smart in-place updates** — re-exporting the same file updates the existing PDF instead of creating *File (1).pdf* duplicates.
- **Multiple Google accounts** — connect Account A and Account B simultaneously; the extension automatically uses the correct token per Drive tab.
- **Universal format support** — Google Workspace, Microsoft Office, OpenDocument, text/data files, and images.
- **In-page status toasts** — progress and result feedback displayed directly in the Google Drive tab, no OS popups.
- **No external server** — all Google API calls go directly from your browser to `googleapis.com`.
- **Ephemeral token storage** — access tokens live only in `chrome.storage.session` (RAM); they are automatically cleared when Chrome closes.
- **No client secret** — the extension uses the implicit OAuth 2.0 flow; no client secret is embedded or transmitted.
- **No Chrome Web Store** — distributed as a ZIP via GitHub Releases; load unpacked in Developer mode.

---

## Supported Formats

| Category | File Types & Extensions | Conversion Method |
|---|---|---|
| **Google Workspace** | Google Docs, Sheets, Slides, Drawings | Native Drive API `files.export` |
| **Microsoft Office** | `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt` | Drive cloud import → Workspace copy → PDF export → temp deleted |
| **OpenDocument** | `.odt`, `.ods`, `.odp` | Drive cloud import → Workspace copy → PDF export → temp deleted |
| **Text & Data** | `.txt`, `.rtf`, `.html`, `.csv`, `.tsv` | Drive cloud import → Workspace copy → PDF export → temp deleted |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp` | In-memory PDF 1.4 binary stream (DCTDecode) |
| **Already PDF** | `.pdf` | Skipped — already a PDF; shown as info toast |
| **Unsupported** | Video, audio, ZIP, executables, etc. | Clear error message listing supported types |

---

## How It Works

```
Active Google Drive / Docs Tab
              │
 Right-click → "Save as PDF to Google Drive"
   (or "Save as PDF" button in popup)
              │
              ▼
       content.js (In Tab)
  • Reads URL (/u/N/, authuser=) for account index
  • Scans Google Bar DOM for active profile email
  • Returns: { fileId, activeAccountHint: { userIndex, email } }
              │
              ▼
       background.js (Service Worker)
              │
       services/auth.js: resolveTokenForTab()
  Priority 1: Exact email match from DOM/URL → route to that account
  Priority 2: Validated session index map (/u/N → email, built after first exact match)
  Priority 3: Only one account connected → use it unambiguously
  Invariant:  If active account is not connected → hard fail, never fall back
              │
              ▼
       services/drive.js: verifyCurrentFileAccess()
  • Confirms token can access the file
  • Returns: { metadata: { name, mimeType, parents } }
              │
              ▼
       services/export.js: exportFileToPdf()
  • Workspace: files.export(mimeType=application/pdf)
  • Office/Text: files.copy → export → files.delete (guaranteed cleanup in finally)
  • Images: download media → in-memory PDF 1.4 wrapper
              │
              ▼
       services/drive.js: findExistingPdf()
  • files.list in parent folder for [Name].pdf
              │
       ┌──────┴──────┐
       ▼             ▼
  [Exists]      [New file]
  PATCH update  POST multipart upload
       └──────┬──────┘
              ▼
     In-page Shadow DOM toast
     "✓ Document.pdf saved to the same folder."
```

---

## Installation

### Requirements

- Google Chrome (version 102 or later)
- Your Google account must be added as a **Test User** by the project owner (see [OAuth Testing Mode](#oauth-testing-mode-and-test-user-requirement))

### Steps

1. **Download the latest ZIP** from the [GitHub Releases page](https://github.com/tanmayshah2705/drive-pdf-saver/releases/latest):
   - Click **[⬇️ Download Drive PDF Saver v1.0.0](https://github.com/tanmayshah2705/drive-pdf-saver/releases/download/v1.0.0/Drive-PDF-Saver-v1.0.0.zip)** or grab **`Drive-PDF-Saver-v1.0.0.zip`** under *Assets* on the release page.
   - Do **not** use the auto-generated *Source code* ZIP — it contains development tools and won't load as a clean extension.

2. **Extract the ZIP** to a permanent folder on your computer:
   - Windows: `C:\Extensions\drive-pdf-saver\`
   - macOS/Linux: `~/Extensions/drive-pdf-saver/`
   - Chrome loads the extension live from this folder — don't delete or move it after loading.

3. **Open Chrome Extensions**:  
   Navigate to `chrome://extensions` in your browser.

4. **Enable Developer Mode**:  
   Toggle the **Developer mode** switch in the top-right corner of the extensions page.

5. **Click "Load unpacked"**:  
   Select the extracted `drive-pdf-saver/` folder (the one that contains `manifest.json`).

6. **Pin the Extension** (optional but recommended):  
   Click the puzzle-piece icon in Chrome's toolbar, find *Drive PDF Saver*, and click the pin.

7. **Connect your Google Account** — see [First-Time Google Account Setup](#first-time-google-account-setup).

---

## First-Time Google Account Setup

1. Click the **Drive PDF Saver** icon in Chrome's toolbar to open the popup.
2. Click **+ Connect**.
3. A Google sign-in window will appear. Select the Google account you want to use with Drive PDF Saver.
4. Review the requested permission (*See, edit, create, and delete all of your Google Drive files*) and click **Allow**.
5. The account will appear in the *Connected Accounts* list in the popup.
6. Navigate to any supported file in Google Drive and right-click to save as PDF.

> **Note:** If you see *"Access blocked: Drive PDF Saver has not completed the Google verification process"*, your Google account must be added as a Test User by the project owner. See [OAuth Testing Mode](#oauth-testing-mode-and-test-user-requirement).

---

## Multiple-Account Usage

Drive PDF Saver can maintain **simultaneous authorizations** for multiple Google accounts. Accounts are stored independently — their tokens are never mixed.

### Connecting additional accounts

1. Open the Drive PDF Saver popup.
2. Click **+ Connect**.
3. In the Google account picker, select a **different** Google account from the one already connected (or sign in to a new one).
4. Approve access. The new account appears in the *Connected Accounts* list alongside existing ones.
5. Repeat for each account you want to use.

### How account routing works

Google's multi-login system embeds an account index in every Drive/Docs URL:

| URL pattern | Meaning |
|---|---|
| `drive.google.com/u/0/...` | Account 0 (first logged-in account) |
| `drive.google.com/u/1/...` | Account 1 (second logged-in account) |
| `docs.google.com/...?authuser=1` | Account index 1 |

When you trigger *Save as PDF*:

1. The extension reads the current tab URL for `/u/N/` or `authuser=N`.
2. It also scans the Google Bar (profile button) in the page DOM for the active account's email address.
3. It matches the detected email to a connected account and uses **only that account's token**.
4. The validated index→email mapping is saved in `chrome.storage.session` so subsequent saves in the same Chrome session route correctly even if the email cannot be re-read from the DOM.

**Strict invariant:** If the active Drive tab shows Account A, and Account A is connected, Account A's token is always used. If Account A is not connected, you receive a clear error — the extension **never** silently uses Account B's token.

### Disconnecting an account

Open the popup and click **Disconnect** next to any account. This removes it from the registry and evicts its session token.

---

## Saving and Updating PDFs

### New PDF

If no file named `[OriginalName].pdf` exists in the file's parent Drive folder, a new PDF is uploaded there using `files.create` with `uploadType=multipart`.

### Update in-place

If a file named `[OriginalName].pdf` **already exists** in the same folder, Drive PDF Saver updates it with a `PATCH` request (`uploadType=media`). The existing file ID is preserved — no duplicates, no `Report (1).pdf`.

### Changing output behaviour

- To create a fresh PDF (not update), rename the original file before exporting, or rename the existing PDF first.
- The same-folder search is scoped strictly to the file's `parents[0]` folder — it won't accidentally match PDFs in other folders with the same name.

---

## Permissions Explained

| Permission | Why it's needed |
|---|---|
| `identity` | Required to open the Google OAuth window (`chrome.identity.launchWebAuthFlow`) so users can authorize Drive access. |
| `contextMenus` | Registers the "Save as PDF to Google Drive" right-click menu item on supported Google URLs. |
| `activeTab` | Lets the service worker query the current tab's URL and communicate with the content script for file info and account detection. |
| `storage` | Stores connected account identities (`chrome.storage.local`) and the session index map (`chrome.storage.session`). OAuth tokens are also held in `chrome.storage.session`. |
| `https://www.googleapis.com/*` | Google Drive API v3 calls (file metadata, export, upload, list). |
| `https://oauth2.googleapis.com/*` | Token endpoint (used only as a fallback; primary flow is implicit). |
| `https://accounts.google.com/*` | Google OAuth authorization endpoint for `launchWebAuthFlow`. |

---

## Privacy and Security

- **No external server.** Every API call goes directly from your browser to `googleapis.com` or `accounts.google.com`. No intermediary, no proxy.
- **No client secret in the extension.** Drive PDF Saver uses the OAuth 2.0 implicit flow (token response type). No `client_secret` is embedded in source code or transmitted.
- **Tokens stored in session memory only.** `chrome.storage.session` is an in-memory store — it is automatically cleared when Chrome closes. Tokens are never written to disk.
- **Account identity stored locally.** The list of connected account emails and display names is stored in `chrome.storage.local` so the popup can show which accounts are linked across Chrome restarts. Tokens are not stored here.
- **No analytics or telemetry.** The extension collects no usage data of any kind.
- **In-memory PDF processing.** PDF blobs are created in browser RAM and uploaded immediately to Google Drive. No temporary files are ever written to disk.
- **Temp Drive files auto-deleted.** For Office and text file conversion, a temporary Workspace copy is created in Drive, exported, and then immediately deleted — inside a `finally` block that guarantees cleanup even on failure.

Full details: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

---

## OAuth Testing Mode and Test User Requirement

Drive PDF Saver uses Google Cloud OAuth in **Testing** mode (not Production). This has the following implications:

- The app is **not verified** by Google — you will see a warning screen during first authorization. This is expected. Click **Continue** (or **Advanced → Go to Drive PDF Saver**).
- Only Google accounts explicitly listed as **Test Users** in the Google Cloud Console OAuth consent screen can authorize the app. Anyone else will see *"Access blocked"*.
- Up to 100 Test Users can be added at no cost.
- No custom domain, CASA security review, or Chrome Web Store listing is required.

**If you are a new user** and receive *"Access blocked"*, contact the project owner to have your Google email added as a Test User.

**Project OAuth details:**

| Setting | Value |
|---|---|
| OAuth Client Type | Web Application |
| Client ID | `48459272093-0kkpphs9kh70jbd3vnvl33l5qb8okdmi.apps.googleusercontent.com` |
| Authorized Redirect URI | `https://aijdgafbjdkfalbceioihafdkepiikce.chromiumapp.org/` |
| Extension ID (fixed) | `aijdgafbjdkfalbceioihafdkepiikce` |
| Scope | `https://www.googleapis.com/auth/drive` |
| OAuth Consent Status | **Testing** |

The Extension ID is fixed by the `"key"` field in `manifest.json`. Every user who loads this extension unpacked will have the same ID — which is required for the OAuth redirect URI to work correctly.

---

## 7-Day Token Limitation

Google Cloud OAuth in **Testing** mode with an online (non-offline) token flow does not issue refresh tokens. Access tokens expire after approximately 1 hour and cannot be automatically renewed silently.

Additionally, Google Testing mode tokens may become invalid after **7 days** if the user does not re-authorize.

**Effect:** After 7 days of inactivity, a "Please reconnect" error appears when trying to Save as PDF.

**Fix:** Open the popup, click **+ Connect** on the affected account, and authorize again. This takes about 5 seconds.

This limitation applies **only in Testing mode**. In Production OAuth mode, refresh tokens would allow long-lived silent re-authorization. This project intentionally stays in Testing mode to avoid the Production verification process.

---

## Troubleshooting

### "Access blocked" / "App not verified"

Your Google account must be added as a Test User by the project owner. Contact the owner and provide your Google email address.

### "No Google accounts are connected"

Open the popup and click **+ Connect** to authorize at least one Google account.

### "Multiple Google accounts connected and the active account could not be determined"

The extension could not determine which of the connected accounts corresponds to the current Drive tab. Navigate to the Google Drive tab for the account you want to use. Make sure the URL contains `/u/0/`, `/u/1/`, etc. (Google Drive multi-login URLs always include this when multiple accounts are signed in).

### The right-click menu item doesn't appear

The context menu is scoped to:
- `https://docs.google.com/document/*`
- `https://docs.google.com/spreadsheets/*`
- `https://docs.google.com/presentation/*`
- `https://docs.google.com/drawings/*`
- `https://drive.google.com/*`

It will not appear on other websites. If you just reloaded the extension, refresh the document tab once.

### "This file type cannot be converted to PDF"

Only supported formats are converted (see [Supported Formats](#supported-formats)). Video, audio, ZIP archives, and binary executables cannot be converted.

### PDF not appearing in Drive after export

Check that the account used has write permission to the file's parent folder. The extension shows a clear in-page error if the Drive API returns an error during upload.

### Extension stops working after ~7 days

Re-authorize via the popup (see [7-Day Token Limitation](#7-day-token-limitation)).

---

## Project Structure

```
drive-pdf-saver/
├── manifest.json            # Manifest V3: permissions, OAuth, content scripts, service worker
├── background.js            # Service worker: context menu, message routing, export pipeline
├── content.js               # In-tab: active account detection (DOM + URL), file info, toasts
├── index.html               # GitHub Pages landing page
├── PRIVACY_POLICY.md        # Open-source privacy policy
├── LICENSE                  # MIT License
│
├── popup/
│   ├── popup.html           # Extension popup UI (Connected Accounts, Save button)
│   ├── popup.js             # Popup logic: account list, connect/disconnect, save trigger
│   └── popup.css            # Google Material Design-inspired styling
│
├── services/
│   ├── accounts.js          # OAuth flow (launchWebAuthFlow implicit), account registry,
│   │                        #   token cache (session), session index map
│   ├── auth.js              # resolveTokenForTab(): multi-account routing, clearAuthToken()
│   ├── drive.js             # Drive API v3: metadata, folder search, upload, patch, delete
│   ├── export.js            # Universal export router: Workspace, Office/text, images
│   └── file.js              # MIME classification, URL parsing, PDF filename generation
│
└── utils/
    ├── helpers.js           # log(), sanitizeDriveQuery()
    └── notifications.js     # showProgress(), showSuccess(), showError() → in-page toasts
```

---

## Development and Testing

### Running automated tests

```bash
node scratch/test_suite.mjs              # Full suite: 54 tests (manifest, URL parsing,
                                         #   account routing invariants, file categorization,
                                         #   filename utilities, PDF stream validation)
node scratch/test_multi_account_routing.mjs  # 6 dedicated multi-account routing tests
```

### Checking JavaScript syntax

```bash
node --check background.js
node --check content.js
node --check services/accounts.js
node --check services/auth.js
node --check services/drive.js
node --check services/export.js
node --check services/file.js
node --check utils/helpers.js
node --check utils/notifications.js
node --check popup/popup.js
```

### Loading the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this directory.
4. Reload the extension after any code change (click the 🔄 icon on the card).
5. For service worker changes, also click the **service worker** link to inspect the console.

### Generating icons (if needed)

```powershell
.\generate_icons.ps1
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*Drive PDF Saver is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Google LLC. Google Drive, Google Docs, Google Workspace, and Chrome are trademarks of Google LLC.*
