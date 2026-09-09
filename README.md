# Save as PDF to Google Drive (Chrome Extension - Manifest V3)

A fast, lightweight Chrome Extension that converts your active Google Doc, Sheet, or Slide to PDF and saves it directly into the **exact same Google Drive folder** using official Google Drive v3 APIs.

No downloading to disk. No manual uploading. No folder picking. Zero UI automation.

---

## How It Works

```
   Google Workspace Tab (Doc / Sheet / Slide)
                       │
             [Right-Click Anywhere]
                       │
        "Save as PDF to Google Drive"
                       │
                       ▼
            Background Service Worker
                       │
            1. Silent-First OAuth (chrome.identity)
                       │
            2. Authoritative Metadata (files.get)
               - Fetch document name & parent folder ID
               - Verify exportable Workspace MIME type
                       │
            3. Pure In-Memory Export (files.export)
               - Export directly to binary PDF Blob
                       │
            4. Same-Folder Check (files.list)
               - Check if [DocName].pdf already exists
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
    [Already Exists]         [New File]
    Update content in-place  Upload new PDF
    (PATCH uploadType=media) (POST uploadType=multipart)
           └───────────┬───────────┘
                       ▼
          Chrome Status Notification
      "✓ Resume.pdf saved to Google Drive"
```

---

## Project Structure

```
drive-pdf-saver/
├── manifest.json            # Manifest V3 configuration (ES module service worker)
├── background.js            # Service worker orchestrating the Drive API pipeline
├── content.js               # Lightweight tab URL detector (zero DOM scraping)
│
├── popup/
│   ├── popup.html           # Extension action popup
│   ├── popup.js             # Real-time status and export action
│   └── popup.css            # Google Material styled popup
│
├── services/
│   ├── auth.js              # Token management with silent caching & interactive fallback
│   ├── drive.js             # Drive API v3 (metadata, search, multipart upload, in-place update)
│   ├── export.js            # files.export to in-memory PDF Blob
│   └── file.js              # URL parsing, MIME type verification, filename generator
│
├── utils/
│   ├── notifications.js     # User notification manager
│   └── helpers.js           # Logger and Drive query sanitization
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── README.md
```

---

## Setup Instructions

### 1. Create a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project selector dropdown at the top and select **New Project**.
3. Name your project (e.g., `Drive PDF Saver`) and click **Create**.
4. Select the newly created project.

### 2. Enable Google Drive API
1. In the left navigation menu, go to **APIs & Services → Library**.
2. Search for **Google Drive API**.
3. Click on **Google Drive API** and click the **Enable** button.

### 3. Configure OAuth Consent Screen
1. Go to **APIs & Services → OAuth consent screen**.
2. Select **External** (or **Internal** if using a Google Workspace organization) and click **Create**.
3. Fill in the required fields:
   - **App name**: `Save as PDF to Google Drive`
   - **User support email**: Select your email.
   - **Developer contact information**: Enter your email.
4. Click **Save and Continue**.
5. Under **Scopes**:
   - Click **Add or Remove Scopes**.
   - Select or enter: `https://www.googleapis.com/auth/drive`.
   - Click **Update** and then **Save and Continue**.
6. Under **Test users** (**Important!**):
   - Click **Add Users**.
   - Enter your personal Google email address (the one you will use to test the extension).
   - Click **Save and Continue**.

> **Note on App Verification:** Because this is for personal/local use and the OAuth consent screen is in **Testing** mode, you do **NOT** need to submit the app for Google's public verification. Only authorized test users can log in.

### 4. Load the Extension to Get your Extension ID
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `drive-pdf-saver` directory from your computer.
5. Locate the newly loaded extension and copy its **32-character ID** (e.g. `abcdefghijklmnopqrstuvwxyzabcdef`).

### 5. Create an OAuth 2.0 Client ID
1. In Google Cloud Console, navigate to **APIs & Services → Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. In the **Application type** dropdown, select **Chrome extension**.
4. In the **Item ID** field, paste your 32-character Extension ID from step 4.
5. Give the client a name (e.g. `Chrome Extension Client`) and click **Create**.
6. Copy the generated **Client ID** (e.g. `1234567890-xxx.apps.googleusercontent.com`).

### 6. Add Client ID to `manifest.json`
1. Open [`manifest.json`](file:///c:/Users/shahv/OneDrive/Desktop/pdf_Extension_App/drive-pdf-saver/manifest.json).
2. Replace `YOUR_CLIENT_ID_HERE.apps.googleusercontent.com` with your actual Client ID:
   ```json
   "oauth2": {
     "client_id": "1234567890-xxx.apps.googleusercontent.com",
     "scopes": [
       "https://www.googleapis.com/auth/drive"
     ]
   }
   ```
3. Save `manifest.json`.
4. Return to `chrome://extensions` and click the **Reload (🔄)** icon on the extension card.

---

## Usage

### Method 1: Right-Click Context Menu (Primary Workflow)
1. Open any Google Doc, Google Sheet, or Google Slide.
2. Right-click anywhere on the document.
3. Select **“Save as PDF to Google Drive”**.
4. On first run, Google will prompt you once to grant access to Google Drive.
5. Watch the notifications:
   - *Exporting Document...*
   - *Uploading Document.pdf...*
   - *✓ Document.pdf saved to Google Drive*
6. Check your Google Drive folder: the PDF will be right beside your original file!

### Method 2: Extension Popup
1. While viewing a Google Doc, Sheet, or Slide, click the extension icon in Chrome's toolbar.
2. The popup displays the detected document name and service.
3. Click **Save as PDF**.

---

## Key Behaviors

### 1. Same Folder Guarantee
- The extension queries the file's authoritative `parents` list from Google Drive API.
- The PDF is uploaded to `parents[0]`.
- If the original document is in **My Drive** (root), the PDF is saved in root.
- If the document is inside nested folders (e.g. `My Drive / Career / Resumes`), the PDF is created in `Resumes`.

### 2. Duplicate Prevention (In-Place Replacement)
- If `Resume.pdf` already exists in that folder, the extension **updates the existing PDF's binary content in-place** via a `PATCH` media upload.
- It preserves the existing PDF's file ID, sharing links, and folder position.
- It **never** creates duplicate files like `Resume (1).pdf` or `Resume (2).pdf`.
- The original Google Doc is never modified or replaced.

### 3. Silent-First OAuth (No Repeat Account Choosers)
- The extension first executes `chrome.identity.getAuthToken({ interactive: false })`.
- Subsequent exports run completely silently in the background without prompting you.
- If a token expires (HTTP 401), the cache is cleared and re-authorization is triggered automatically.

### 4. Multi-Account Handling
- Chrome's identity API authenticates with the primary Google account signed into your Chrome profile.
- If the document being viewed belongs to a different Google account not accessible by the authenticated token, Google Drive API returns 404 or 403.
- The extension catches this and displays a clear message:
  > *"Could not access this file with the authorized Google account. Please ensure the signed-in account has permission."*
- It **never** silently uploads your PDF to the wrong account.

---

## Supported File Types

| Category | File Formats | Conversion & Export Strategy |
| :--- | :--- | :--- |
| **Google Workspace** | Google Docs, Sheets, Slides, Drawings | Direct official Google Drive API `files.export` (`mimeType=application/pdf`) |
| **Microsoft Word & Text** | `.docx`, `.doc`, `.odt`, `.rtf`, `.txt`, `.html`, `.md` | Drive API temporary copy with Google Docs import (`application/vnd.google-apps.document`) → `files.export` → temporary copy automatically deleted |
| **Microsoft Excel & Data** | `.xlsx`, `.xls`, `.ods`, `.csv`, `.tsv` | Drive API temporary copy with Google Sheets import (`application/vnd.google-apps.spreadsheet`) → `files.export` → temporary copy automatically deleted |
| **Microsoft PowerPoint** | `.pptx`, `.ppt`, `.odp` | Drive API temporary copy with Google Slides import (`application/vnd.google-apps.presentation`) → `files.export` → temporary copy automatically deleted |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp` | Direct Drive media download → in-memory `OffscreenCanvas` processing → RFC-compliant PDF Blob construction |
| **Existing PDF** | `.pdf` | Friendly notice: *"This file is already a PDF in this folder."* |

---

## Troubleshooting

### "Google authorization was not granted"
- Ensure your Google account is added to the **Test users** list in the Google Cloud Console OAuth consent screen.
- Verify that the **Client ID** in `manifest.json` matches your Google Cloud Console Chrome extension client ID.
- Verify that the **Item ID** in the Cloud Console credentials matches the 32-character Extension ID in `chrome://extensions`.

### "Could not access this file with the authorized Google account"
- Check that the active Chrome profile's primary Google account has View/Edit permissions on the document.
- If you use multiple Google accounts in one browser window, open the document in the Chrome profile matching the document's owner.

### Inspecting Extension Logs
1. Navigate to `chrome://extensions`.
2. Find **Save as PDF to Google Drive**.
3. Click the link labeled **service worker** (or `Inspect views: service worker`).
4. In DevTools, view the Console tab for all events prefixed with `[DrivePDF]`.
