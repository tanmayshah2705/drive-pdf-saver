# Drive PDF Saver (Chrome Extension — Manifest V3)

A production-ready Google Chrome Extension that converts any active Google Doc, Sheet, Slide, Office file, or image to a PDF and saves it directly into the **exact same Google Drive folder** using official Google APIs.

- **One-Click Simplicity**: Right-click anywhere and select **"Save as PDF to Google Drive"**, or click the blue button in the extension popup.
- **Same-Folder Guarantee**: Automatically detects the original file's parent folder and saves the PDF right alongside it.
- **In-Place Updates**: If a PDF with the same name already exists in that folder, it updates in-place without creating duplicates (e.g. `File (1).pdf`).
- **In-Page Feedback**: Displays sleek in-page status toasts directly in your browser tab—no distracting Windows/OS desktop notifications.
- **100% Client-Side & Private**: Direct browser-to-Google communication via official APIs. No intermediary servers, databases, or tracking.

---

## 1. How It Works

```
                     Active Document / File in Browser Tab
                                       │
                     [Right-Click] ➔ "Save as PDF to Google Drive"
                       (or Click button in Extension Popup)
                                       │
                                       ▼
                         Background Service Worker
                                       │
                      1. Silent-First OAuth (chrome.identity)
                         - Acquires access token for user's Google Drive
                                       │
                      2. Access Verification (verifyCurrentFileAccess)
                         - Confirms current account has permission to file
                         - Catches multi-account mismatches before export
                                       │
                      3. Authoritative Metadata (files.get)
                         - Identifies file type, original name, and parent folder ID
                                       │
                      4. In-Memory PDF Conversion
                         ├─ Google Workspace: Drive API files.export
                         ├─ Office/Text files: Drive cloud conversion via temp copy
                         └─ Images: In-memory OffscreenCanvas & DCTDecode PDF wrapper
                                       │
                      5. Same-Folder Check (files.list)
                         - Queries parent folder for existing [Name].pdf
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
               [Already Exists]                   [New File]
             Update content in-place             Upload new PDF
            (PATCH uploadType=media)       (POST uploadType=multipart)
                      └────────────────┬────────────────┘
                                       ▼
                          In-Page Shadow DOM Toast
                 "✓ Document.pdf saved to the same folder."
```

---

## 2. Supported File Formats

| Category | File Types & Extensions | Conversion Strategy |
|---|---|---|
| **Google Workspace** | Google Docs, Sheets, Slides, Drawings | Direct official Google Drive API `files.export` (`mimeType=application/pdf`) |
| **Microsoft Office** | Word (`.docx`, `.doc`), Excel (`.xlsx`, `.xls`), PowerPoint (`.pptx`, `.ppt`) | Official Google Drive cloud conversion via temporary Workspace copy (auto-deleted) |
| **Text & Open Formats** | `.txt`, `.rtf`, `.odt`, `.ods`, `.odp`, `.csv`, `.tsv`, `.html` | Official Google Drive cloud conversion via temporary Workspace copy (auto-deleted) |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp` | High-performance in-memory rasterization & standard PDF 1.4 stream embedding |

---

## 3. Project Architecture

```
drive-pdf-saver/
├── manifest.json            # Manifest V3 (minimal permissions: identity, contextMenus, activeTab)
├── background.js            # Central service worker (ES module) coordinating the export pipeline
├── content.js               # Tab URL detector & Shadow DOM in-page toast notification system
├── index.html               # Public landing page & Privacy Policy for GitHub Pages hosting
├── PRIVACY_POLICY.md        # Official Privacy Policy document compliant with Google User Data Policy
├── STORE_LISTING.md         # Chrome Web Store listing metadata, copy, and permission justifications
├── PUBLIC_RELEASE_CHECKLIST.md # Step-by-step production rollout guide (Google Cloud + Chrome Web Store)
│
├── popup/                   # Extension toolbar popup interface
│   ├── popup.html           # Document detection, status badge, and "Save as PDF to Google Drive" button
│   ├── popup.js             # Real-time state management and message passing
│   └── popup.css            # Clean Google Material 3 styling
│
├── services/                # Modular service layer
│   ├── auth.js              # Token acquisition, cache invalidation, and verifyCurrentFileAccess()
│   ├── drive.js             # Google Drive API v3: metadata, folder search, multipart upload, patch
│   ├── export.js            # Universal export router (Workspace export, Office import, Image wrapper)
│   └── file.js              # MIME type classification, URL parsing, and filename sanitization
│
├── utils/                   # Shared utilities
│   ├── helpers.js           # Logger and Drive query string escaping (sanitizeDriveQuery)
│   └── notifications.js     # Dispatcher for in-page toasts and popup status broadcasts
│
└── icons/                   # Extension icons (16px, 48px, 128px)
```

---

## 4. Local Development Setup

### Prerequisites
- Google Chrome browser.
- A Google Cloud Project with the **Google Drive API** enabled.

### Step 1: Clone the Repository
```bash
git clone https://github.com/tanmayshah2705/drive-pdf-saver.git
cd drive-pdf-saver
```

### Step 2: Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `drive-pdf-saver/` directory.
5. Note the **ID** assigned to the extension (e.g. `abcdefghijklmnopqrstuvwxyz123456`).

### Step 3: Configure Google Cloud OAuth Client
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Drive API** under **APIs & Services** ➔ **Library**.
3. Go to **APIs & Services** ➔ **Credentials**.
4. Click **Create Credentials** ➔ **OAuth client ID**.
5. Select **Application type**: `Chrome app / extension`.
6. Set **Item ID** to the Extension ID from Step 2.
7. Copy the generated Client ID and ensure it matches the `oauth2.client_id` in `manifest.json`.
8. Click the reload icon on `chrome://extensions` to reload the extension.

---

## 5. Chrome Web Store & Public Release

To make Drive PDF Saver available to any Google user on the Chrome Web Store:

1. **Host Public Documentation**:
   - Push this repository to GitHub and enable **GitHub Pages** (Settings ➔ Pages ➔ Source: `main` branch, `/ (root)` folder).
   - Your landing page and privacy policy will be live at: `https://tanmayshah2705.github.io/drive-pdf-saver/`.
2. **Google Cloud Production Setup**:
   - Move the OAuth Consent Screen to **Production** (Publish App).
   - Submit for Google OAuth verification for the `https://www.googleapis.com/auth/drive` scope.
3. **Chrome Web Store Submission**:
   - Package the extension into a `.zip` archive:
     ```powershell
     Compress-Archive -Path manifest.json, background.js, content.js, icons, popup, services, utils -DestinationPath drive-pdf-saver-v1.0.0.zip
     ```
   - Upload the `.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
   - Fill out store listing details using `STORE_LISTING.md`.
   - Submit for review.

> **Full detailed instructions with screenshots and demo video scripts are available in [PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md).**

---

## 6. Multi-Account Handling

Because Google users often have multiple Google accounts (e.g., personal and work/school) open in the same browser session, Drive PDF Saver implements proactive account access verification:

- `chrome.identity.getAuthToken()` authenticates with the Google account signed into the **active Chrome profile**.
- Before attempting any conversion or upload, `verifyCurrentFileAccess()` calls Google Drive API to verify that the active OAuth token has read/write permissions for the document.
- If the file is owned by or open in an account different from the Chrome profile, the extension displays a helpful in-page toast:
  > *"Account mismatch / permission error: Your signed-in Chrome Google account does not have permission to access this file. If you have multiple Google accounts, please ensure this file is shared with your Chrome profile account or switch to the corresponding Chrome profile."*
- This prevents confusing 400 or 403 errors and prevents accidental uploads to the wrong Drive account.

---

## 7. Troubleshooting

### "Google authorization was not granted"
- Ensure your Google account is signed into the Chrome browser profile (`chrome://settings/people`).
- Check that popups/redirects are not blocked by third-party ad blockers.
- During local testing (before OAuth app publication), ensure your email is added under **Test Users** in the Google Cloud Console OAuth consent screen.

### Context menu does not appear on right-click
- The context menu item is scoped to Google Workspace and Google Drive URLs (`docs.google.com` and `drive.google.com`).
- It will not appear on regular websites (e.g. `google.com` or `github.com`).
- If you just reloaded the extension, refresh the document tab once to allow the content script to attach.

### PDF already exists
- If a file with the name `[Document Name].pdf` already exists in that exact parent folder, the extension automatically updates its content in place.
- If you want a separate file, simply rename your document before exporting or rename the existing PDF.

---

## 8. License

This project is licensed under the [MIT License](LICENSE).
