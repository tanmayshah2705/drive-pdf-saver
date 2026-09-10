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
├── manifest.json            # Manifest V3 (deterministic key, identity, contextMenus, activeTab)
├── background.js            # Central service worker (ES module) coordinating the export pipeline
├── content.js               # Tab URL detector & Shadow DOM in-page toast notification system
├── PRIVACY_POLICY.md        # Open-source privacy policy document
│
├── popup/                   # Extension toolbar popup interface
│   ├── popup.html           # Document detection, account info, and "Save as PDF to Google Drive" button
│   ├── popup.js             # Real-time state management, account switcher, and message passing
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

## 4. Installation for Test Users (From GitHub)

1. **Download the Extension**:
   - Clone the repo:
     ```bash
     git clone https://github.com/tanmayshah2705/drive-pdf-saver.git
     ```
   - *Or click "Code ➔ Download ZIP" on GitHub and extract the folder.*
2. **Load into Chrome**:
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** and select the `drive-pdf-saver/` directory.
3. **Use with Your Google Account**:
   - Open any Google Doc, Sheet, Slide, Office file, or image in Google Drive.
   - Right-click anywhere and select **"Save as PDF to Google Drive"** (or open the extension popup and click the blue button).
   - Google will display an authorization prompt on first use asking you to authorize Drive PDF Saver.
   - Approve access. The PDF will be saved directly into your own Google Drive folder!

---

## 5. Google Cloud Configuration (Testing Mode)

Because `manifest.json` contains a deterministic public key (`"key"`), Chrome assigns the **exact same Extension ID** to every user who loads this extension unpacked:

**Fixed Extension ID for all users:**
```
aijdgafbjdkfalbceioihafdkepiikce
```

The extension operates in Google Cloud **Testing** mode (zero cost, no app verification, no custom domain):

1. **Google Drive API**: In [Google Cloud Console](https://console.cloud.google.com/), ensure **Google Drive API** is enabled under **APIs & Services ➔ Library**.
2. **OAuth Consent Screen**:
   - User Type: **External**.
   - App Name: `Drive PDF Saver`.
   - Publishing Status: **Testing** *(Leave in Testing mode — do NOT publish to production!)*.
   - Scopes: `https://www.googleapis.com/auth/drive`.
   - **Test Users**: Add your Google account and any test user accounts (supports up to 100 test accounts). Only accounts listed here can authorize the extension.
3. **OAuth 2.0 Client ID**:
   - In **APIs & Services ➔ Credentials**, ensure the OAuth client ID is of type **Chrome app / extension**.
   - Item ID: `aijdgafbjdkfalbceioihafdkepiikce`.
   - Client ID: `48459272093-tmv1556u1hblmk7i6hga8urufap8linh.apps.googleusercontent.com` (configured in `manifest.json`).

---

## 6. Multi-Account Handling & Token Lifecycle

Because users frequently have multiple Google accounts (personal, work, school) logged into Chrome, Drive PDF Saver implements a proactive access-verification and re-authorization lifecycle:

1. **Automatic Account Verification**: Before converting or uploading, `verifyCurrentFileAccess()` calls Google Drive API to verify that the active token has permission to access the file.
2. **Self-Healing on Account Mismatch**:
   - If a 401, 403, or 404 is detected (e.g. Chrome profile is Account A, but document belongs to Account B), the extension automatically evicts the stale token from Chrome's cache and prompts interactive Google account authorization once.
   - If the newly authorized account has access, the export finishes seamlessly.
   - If access still fails, it stops safely with an informative error stating: *"The currently authorized Google account (user@example.com) cannot access this file. Please switch accounts or share the file."*
   - **Guaranteed safety**: Zero files are ever written to the wrong Drive account.
3. **Manual Account Switcher**: Open the extension popup at any time to see which Google account is currently authorized and click **"Switch"** to re-authorize with a different Google account on demand.

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
