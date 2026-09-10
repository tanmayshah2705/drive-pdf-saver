# Privacy Policy for Drive PDF Saver

**Last Updated: September 10, 2026**

This Privacy Policy explains how the **Drive PDF Saver** Chrome Extension ("the Extension", "we", "us", or "our") handles user information and data.

---

## 1. Overview & Core Philosophy

**Drive PDF Saver operates entirely client-side within your browser.**
We believe your data belongs to you. The extension does NOT operate any external servers, databases, or third-party tracking services. All interactions with your Google Drive files occur directly between your web browser and official Google APIs using secure HTTPS connections.

---

## 2. Information We Access

To perform its single function—converting and saving files as PDFs in your Google Drive—the Extension accesses:

1. **Google Drive File Metadata**:
   - File ID, file title/name, MIME type, and parent folder IDs.
   - Purpose: To identify the document currently open in your browser tab, verify that it is supported for conversion, and locate the same parent folder in which to save the resulting PDF.

2. **Google Drive File Content (Only When Requested by You)**:
   - When you explicitly right-click and select **"Save as PDF to Google Drive"** or click the button in the extension popup, the Extension requests Google Drive to export or convert your document to PDF.
   - The PDF is held temporarily in your browser's local memory (RAM) and immediately uploaded to the same folder in your Google Drive.
   - Once uploaded, the in-memory data is discarded. No copy is kept on disk, and no content is ever sent to any third party.

---

## 3. Information We Do NOT Collect

We do **NOT**:
- Operate a backend server or database.
- Collect, store, or transmit your personal identifiable information (PII).
- Log, monitor, or track your browsing activity or document contents.
- Read or access browser cookies or authentication credentials.
- Sell, rent, monetize, or share your data with any third party, advertiser, or data broker.
- Use Google Workspace user data to train, retrain, or improve generalized AI and/or ML models.

---

## 4. Google OAuth 2.0 & Permissions

### A. Authentication
Drive PDF Saver uses the standard Google Chrome Identity API (`chrome.identity`) to request authorization via OAuth 2.0.
- When prompted, you authorize the Extension to interact with your Google Drive.
- The resulting access token is managed securely by your Chrome browser.
- The Extension never sees or stores your Google account password.

### B. Google Drive OAuth Scope
The Extension requests the following permission scope:
- `https://www.googleapis.com/auth/drive`

**Why is this scope needed?**
Google Workspace files (Docs, Sheets, Slides) opened independently in your browser cannot be accessed via the restricted `drive.file` scope (which only grants access to files created by the application itself or opened through Google Picker). To read metadata of the document you already have open, export it to PDF via the official Google Drive API (`files.export`), search for existing PDFs in the same parent folder, and upload/update the PDF in that same folder, the extension requires access to the Google Drive API.

### C. Chrome Extension Permissions
- **`identity`**: Used to obtain an OAuth 2.0 access token via `chrome.identity.getAuthToken`.
- **`contextMenus`**: Used to display the "Save as PDF to Google Drive" option when right-clicking on supported Google Drive and Google Workspace pages.
- **`activeTab`**: Used to identify the document URL of the tab where you triggered the action and display in-page status toasts.

---

## 5. Google API Services User Data Policy Compliance

Drive PDF Saver's use and transfer to any other app of information received from Google APIs will adhere to the **[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)**, including the **Limited Use** requirements.

Specifically:
1. Data is only used to provide the user-facing feature of converting and saving documents as PDFs to the user's Google Drive.
2. Data is never transferred to any third party.
3. Data is never used for advertising or marketing.
4. Humans do not read user data.

---

## 6. Data Retention and Security

- **Zero Data Retention**: The extension does not retain any files, tokens, or personal information on any server. In-memory data is freed as soon as the PDF upload finishes.
- **Direct Encryption**: All data transferred between your browser and Google Drive is encrypted in transit using industry-standard Transport Layer Security (HTTPS/TLS).

---

## 7. Open Source Transparency

Drive PDF Saver is open source. You can inspect the complete source code, verify that no data is collected or transmitted to third parties, and report issues at:
- **Repository**: [https://github.com/tanmayshah2705/drive-pdf-saver](https://github.com/tanmayshah2705/drive-pdf-saver)
- **Homepage / Documentation**: [https://tanmayshah2705.github.io/drive-pdf-saver/](https://tanmayshah2705.github.io/drive-pdf-saver/)

---

## 8. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or regulatory requirements. Any updates will be posted to this page and our GitHub repository with an updated revision date.

---

## 9. Contact Us

If you have questions or feedback regarding this Privacy Policy or the security of the Extension, please open an issue on GitHub:
- **GitHub Issues**: [https://github.com/tanmayshah2705/drive-pdf-saver/issues](https://github.com/tanmayshah2705/drive-pdf-saver/issues)
