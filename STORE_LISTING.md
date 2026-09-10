# Chrome Web Store Listing: Drive PDF Saver

This document contains the exact metadata, copy, and permission justifications needed when submitting **Drive PDF Saver** to the Chrome Web Store.

---

## 1. Store Metadata

| Field | Content |
|---|---|
| **Extension Name** | `Drive PDF Saver` |
| **Short Description** *(Max 132 chars)* | `Save any Google Doc, Sheet, Slide, Office file, or image directly as a PDF in the same Google Drive folder with one right-click.` *(129 chars)* |
| **Category** | Productivity |
| **Primary Language** | English |
| **Pricing** | Free |
| **Website / Homepage** | `https://tanmayshah2705.github.io/drive-pdf-saver/` |
| **Privacy Policy URL** | `https://tanmayshah2705.github.io/drive-pdf-saver/#privacy` |
| **Support URL** | `https://github.com/tanmayshah2705/drive-pdf-saver/issues` |

---

## 2. Detailed Store Description

```markdown
Save time and simplify your document workflow with Drive PDF Saver!

Tired of the tedious multi-step process to get a PDF version of your Google Drive files? 
(Edit file ➔ File ➔ Download ➔ PDF ➔ Find file on computer ➔ Upload back to Google Drive ➔ Move to the right folder)

With Drive PDF Saver, you can do all of that with a single right-click or a single click on the extension popup.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Open any Google Doc, Sheet, Slide, Office file, or image in Google Drive.
2. Right-click anywhere on the page and select "Save as PDF to Google Drive" (or click the blue button in the extension popup).
3. The extension communicates directly with the official Google Drive API to export or convert your document into a crisp PDF in memory.
4. The PDF is saved directly into the SAME Google Drive folder as the original file.
5. If a PDF with the same name already exists in that folder, it updates in place—no messy duplicate files like "Document (1).pdf"!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Right-Click Simplicity: Never navigate multi-level menus again. Right-click anywhere and save.
• Same Folder Guarantee: Automatically detects your document's parent folder and puts the PDF right where it belongs.
• In-Place Updates: Re-exporting an edited document updates the existing PDF version seamlessly.
• Universal Conversion Support:
  - Google Workspace: Google Docs, Google Sheets, Google Slides, Google Drawings
  - Microsoft Office: Word (.docx, .doc), Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt)
  - Text & Open Formats: .txt, .rtf, .odt, .ods, .odp, .csv, .html
  - Images: .png, .jpg, .jpeg, .webp, .gif, .bmp
• In-Page Toast Feedback: Sleek, non-intrusive in-page status toasts let you know when the export finishes without cluttering your desktop with OS notification banners.
• 100% Client-Side Privacy: No third-party servers, no analytics, no external databases. All operations take place strictly between your browser and Google's official Drive APIs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 PRIVACY & SECURITY PROMISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your data belongs exclusively to you.
• Zero Backend: Drive PDF Saver has no backend servers.
• Direct Google API: All API calls go directly from your Chrome browser to Google Drive via secure HTTPS.
• Limited Use Compliance: Drive PDF Saver adheres strictly to the Google API Services User Data Policy, including Limited Use requirements.
• Open Source: Full source code is publicly inspectable on GitHub: https://github.com/tanmayshah2705/drive-pdf-saver
```

---

## 3. Single Purpose Justification

**Single Purpose Description:**
> "Convert and save currently opened Google Drive documents directly as PDF files into the same Google Drive folder."

---

## 4. Permissions Justification (For Chrome Web Store Review)

When submitting, the Chrome Web Store developer dashboard requires justifications for requested permissions and host permissions:

### `identity`
> **Justification:** "Used to obtain an OAuth 2.0 access token via `chrome.identity.getAuthToken`. This allows the extension to authenticate directly with Google Drive API v3 to read the open file's metadata, export it to PDF, and upload the resulting PDF to the user's Google Drive account."

### `contextMenus`
> **Justification:** "Used to provide a 'Save as PDF to Google Drive' context menu item when the user right-clicks on any open Google Docs, Google Sheets, Google Slides, or Google Drive file preview page."

### `activeTab`
> **Justification:** "Used to extract the document URL of the tab where the user invoked the 'Save as PDF to Google Drive' command, identify the file ID, and send in-page toast notifications to update the user on the export and save progress."

### Host Permissions (`https://docs.google.com/*`, `https://drive.google.com/*`, `https://www.googleapis.com/*`)
> **Justification:**
> - `https://docs.google.com/*` and `https://drive.google.com/*`: "Required for the content script to run on Google Docs, Sheets, Slides, and Drive file preview tabs to detect document ID and display in-page status toasts."
> - `https://www.googleapis.com/*`: "Required to make direct HTTPS REST requests to the Google Drive v3 API (`drive/v3/files`) to read document metadata, export/convert the file to PDF, and upload the PDF directly to Google Drive."

---

## 5. Store Asset Specifications

Before submitting to the Chrome Web Store, prepare the following graphic assets:

| Asset | Size | Format | Description |
|---|---|---|---|
| **Extension Icon** | 128x128 px | PNG | High-resolution icon with transparent background (already provided in `icons/icon128.png`). |
| **Small Promo Tile** *(Mandatory)* | 440x280 px | PNG or JPEG | Displays in Chrome Web Store search results and category pages. |
| **Large Promo Tile** *(Optional)* | 920x680 px | PNG or JPEG | Used for featured extensions. |
| **Marquee Promo Tile** *(Optional)* | 1400x560 px | PNG or JPEG | Used for top banner feature carousel. |
| **Screenshots** *(At least 1 required, up to 5)* | 1280x800 px or 640x400 px | PNG or JPEG | Visual demonstrations showing: 1) Right-click context menu on a Google Doc, 2) In-page toast showing "Saved to Google Drive", 3) Extension popup interface, 4) Google Drive folder showing the created PDF alongside original document. |
