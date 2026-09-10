# Drive PDF Saver v1.0.0

## What is Drive PDF Saver?

A Chrome Extension (Manifest V3) that adds a **"Save as PDF to Google Drive"** right-click menu item to Google Drive, Google Docs, Sheets, Slides, Drawings, and any supported file opened in Google Drive. The resulting PDF is saved into the **same Drive folder** as the original — and updates the existing PDF in-place on subsequent saves instead of creating duplicates.

---

## What's Included in This Release

This is the initial public release. All features described below are fully implemented.

### Multi-Account Support

- Connect **multiple Google accounts** simultaneously through the extension popup.
- Each Drive tab's active account is detected automatically (via URL `/u/N/` path segments, `authuser` query parameters, and Google Bar DOM inspection).
- The correct account's token is routed per tab — Account A's Drive tab always uses Account A's authorization, never Account B's.
- Accounts are never guessed or cross-contaminated. If the active account is ambiguous and multiple accounts are connected, the extension fails with a clear error rather than silently using the wrong account.

### Universal PDF Conversion

All conversion is performed by official Google Drive API v3 — no third-party servers:

| File Type | Method |
|---|---|
| Google Docs / Sheets / Slides / Drawings | `files.export` to PDF |
| Word, Excel, PowerPoint (.docx, .xlsx, .pptx, .doc, .xls, .ppt) | Drive cloud import → export → delete temp |
| OpenDocument (.odt, .ods, .odp) | Drive cloud import → export → delete temp |
| Text & data (.txt, .rtf, .html, .csv, .tsv) | Drive cloud import → export → delete temp |
| Images (.png, .jpg, .jpeg, .webp, .gif, .bmp) | In-memory PDF 1.4 binary stream |

### Smart In-Place Updates

Re-exporting a file that already has a PDF with the same name in the same folder **updates** the existing PDF rather than creating duplicates like `Report (1).pdf`.

### Privacy-First Architecture

- No external server — all API calls go directly to `googleapis.com`.
- OAuth access tokens stored **only** in `chrome.storage.session` (in-memory, cleared on Chrome close).
- No client secret embedded in the extension (implicit OAuth flow).
- No analytics, no telemetry, no third-party dependencies.

---

## Installation

### Requirements

- Google Chrome (version 102+)
- Your Google account must be added as a **Test User** by the project owner (OAuth is in Testing mode)

### Steps

1. **Download** `drive-pdf-saver-v1.0.0.zip` from the Assets section below.
2. **Extract** the ZIP to a permanent folder on your computer.
3. Open **`chrome://extensions`** in Chrome.
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the extracted `drive-pdf-saver/` folder.
6. Click the Drive PDF Saver icon in Chrome's toolbar.
7. Click **+ Connect** and sign in with your Google account.
8. Open any Google Drive file and right-click → **"Save as PDF to Google Drive"**.

> **Full guide:** https://tanmayshah2705.github.io/drive-pdf-saver/#install

---

## Known Limitations

| Limitation | Detail |
|---|---|
| **Test User requirement** | OAuth is in Google Cloud Testing mode. Only accounts explicitly listed as Test Users can authorize the extension. |
| **7-day re-authorization** | Implicit flow tokens cannot be silently refreshed. Re-connect via the popup if the extension reports a token error after ~7 days of inactivity. |
| **No refresh tokens** | The Web Application OAuth client in implicit mode issues access tokens only. Background silent re-auth is not available. |
| **Chrome only** | Extension is built for Chromium-based browsers only (Chrome, Edge, Brave with Manifest V3 support). Not compatible with Firefox. |
| **One Drive scope** | The extension requests the full `drive` scope (required for multipart upload and folder search). A more granular scope would require a custom Drive picker API which is out of scope for this release. |
| **Images: basic layout** | Image PDFs are standard single-page PDFs at original image resolution. No reflow, cropping, or page-margin adjustment. |

---

## Release Assets

| File | Description |
|---|---|
| `Drive-PDF-Saver-v1.0.0.zip` | **Extension package** — extract and load unpacked. Contains only runtime files (18 files, ~33 KB). |

**Direct download:**
`https://github.com/tanmayshah2705/drive-pdf-saver/releases/download/v1.0.0/Drive-PDF-Saver-v1.0.0.zip`

> The auto-generated *Source code* ZIP from GitHub contains the full repository including `.git`, test scripts, and development tools. **Use the asset ZIP above**, not the source ZIP.

---

## Verified Test Matrix (this release)

- ✅ 54/54 unit + integration tests passing (`scratch/test_suite.mjs`)
- ✅ 6/6 multi-account routing tests passing (`scratch/test_multi_account_routing.mjs`)
- ✅ `node --check` on all 10 JS files — zero syntax errors
- ✅ Manifest V3 service worker loads without errors in Chrome
- ✅ Single-account Save as PDF (Docs, Sheets, Slides, Word, Excel, PowerPoint, image)
- ✅ Multi-account routing: Account A tab → Account A token, Account B tab → Account B token
- ✅ In-place PDF update (second save with same name)
- ✅ In-page toast notifications (progress, success, error)
- ✅ Connect / Disconnect via popup delegated to service worker (survives popup closure)
- ✅ Token eviction on disconnect

---

## Changelog

### v1.0.0 — Initial Release

- Multi-account OAuth using `chrome.identity.launchWebAuthFlow` (implicit flow)
- Account registry in `chrome.storage.local`; tokens in `chrome.storage.session` only
- Session index map for `/u/N/` → email resolution
- In-page active account detection via URL + Google Bar DOM
- Universal PDF conversion: Workspace, Office, images
- Smart in-place update for same-name PDFs
- Popup redesigned with Connected Accounts list and per-account Disconnect
- All OAuth operations delegated to service worker to survive popup closure
- GitHub Pages landing page

---

## Links

- 🌐 **Landing Page:** https://tanmayshah2705.github.io/drive-pdf-saver/
- 📦 **Repository:** https://github.com/tanmayshah2705/drive-pdf-saver
- 🔒 **Privacy Policy:** https://github.com/tanmayshah2705/drive-pdf-saver/blob/main/PRIVACY_POLICY.md
- 📄 **License:** MIT
