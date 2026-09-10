# Public Release Checklist: Drive PDF Saver

This checklist provides the exact, chronological steps required to take **Drive PDF Saver** from local development to public availability on the Google Chrome Web Store.

---

## Phase 1: GitHub & Public Documentation Setup

Because Google OAuth Verification and Chrome Web Store require a live, publicly accessible homepage and privacy policy, start by publishing your GitHub Pages site.

- [ ] **Step 1.1: Commit and Push to GitHub**
  ```bash
  cd drive-pdf-saver
  git add .
  git commit -m "Production release: Drive PDF Saver v1.0.0"
  git push origin main
  ```
- [ ] **Step 1.2: Enable GitHub Pages**
  1. Go to your GitHub repository: [https://github.com/tanmayshah2705/drive-pdf-saver](https://github.com/tanmayshah2705/drive-pdf-saver)
  2. Click **Settings** ➔ **Pages** (in the left sidebar).
  3. Under **Build and deployment** ➔ **Source**, select **Deploy from a branch**.
  4. Under **Branch**, select `main` and folder `/ (root)`. Click **Save**.
  5. Wait 1–2 minutes, then visit:
     - Homepage: `https://tanmayshah2705.github.io/drive-pdf-saver/`
     - Privacy Policy: `https://tanmayshah2705.github.io/drive-pdf-saver/#privacy`
  6. Confirm both sections load properly in your browser.

---

## Phase 2: Google Cloud Console Production Setup

To allow **any Google user** to install and use the extension with their own Google Drive account without adding them as manual "Test Users", the OAuth consent screen must be moved to Production and submitted for verification.

### 2.1 Enable the Google Drive API
- [ ] Go to the [Google Cloud Console](https://console.cloud.google.com/).
- [ ] Select or create your project (e.g. `Drive PDF Saver`).
- [ ] Navigate to **APIs & Services** ➔ **Library**.
- [ ] Search for **Google Drive API** and ensure it is **Enabled**.

### 2.2 Configure OAuth Consent Screen
- [ ] Navigate to **APIs & Services** ➔ **OAuth consent screen**.
- [ ] Under **User Type**, select **External** and click **Create**.
- [ ] **App Information**:
  - **App name**: `Drive PDF Saver`
  - **User support email**: Select your email address.
  - **App logo**: Upload `icons/icon128.png`.
- [ ] **App Domain**:
  - **Application home page**: `https://tanmayshah2705.github.io/drive-pdf-saver/`
  - **Application privacy policy link**: `https://tanmayshah2705.github.io/drive-pdf-saver/#privacy`
  - **Authorized domains**: Click **+ Add Domain** and enter `github.io`.
- [ ] **Developer Contact Information**:
  - Enter your email address.
- [ ] Click **Save and Continue**.

### 2.3 Add Scopes
- [ ] On the **Scopes** page, click **Add or Remove Scopes**.
- [ ] Search for and check:
  - `.../auth/drive` (See, edit, create, and delete all of your Google Drive files)
- [ ] Click **Update** ➔ **Save and Continue**.

### 2.4 Publish the App (Move out of "Testing" Mode)
- [ ] On the OAuth consent screen summary page, locate **Publishing status**.
- [ ] Click **PUBLISH APP** and confirm.
- [ ] *Note on Verification:* Because `https://www.googleapis.com/auth/drive` is classified as a **Restricted Scope**, Google will prompt you to complete OAuth Verification:
  - **Scope Justification**: Use the copy provided in Section 4 below.
  - **Demonstration Video**: Record a 1-minute screencast showing:
    1. The extension icon and name in Chrome.
    2. Opening a Google Doc.
    3. Right-clicking and clicking "Save as PDF to Google Drive".
    4. The OAuth consent screen showing your project name and client ID.
    5. The in-page toast showing successful PDF creation.
    6. Google Drive showing the PDF in the same folder.
  - Upload the video to YouTube as **Unlisted** and paste the link in the verification form.

---

## Phase 3: Chrome Web Store Developer Dashboard

### 3.1 Register Developer Account
- [ ] Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
- [ ] Sign in with your Google account and pay the one-time $5 developer registration fee if you haven't already.

### 3.2 Create the Extension Package (.zip)
- [ ] Create a clean distribution `.zip` archive containing only the necessary extension files:
  ```powershell
  # Run from the project root:
  Compress-Archive -Path manifest.json, background.js, content.js, icons, popup, services, utils -DestinationPath drive-pdf-saver-v1.0.0.zip -Force
  ```
  *(Do not include `.git`, `node_modules`, markdown documentation, or test scripts in the zip)*.

### 3.3 Create Draft Listing & Acquire Extension ID
- [ ] In the Chrome Web Store Developer Dashboard, click **Add new item**.
- [ ] Upload `drive-pdf-saver-v1.0.0.zip`.
- [ ] Chrome Web Store will assign your item a permanent **Extension ID** (a 32-character lowercase string like `abcdefghijklmnopqrstuvwxyz123456`).
- [ ] Note this Extension ID down.

### 3.4 Link Extension ID in Google Cloud OAuth Credentials
- [ ] Return to [Google Cloud Console](https://console.cloud.google.com/) ➔ **APIs & Services** ➔ **Credentials**.
- [ ] Click **Create Credentials** ➔ **OAuth client ID**.
- [ ] Application type: **Chrome app / extension**.
- [ ] **Item ID**: Paste the 32-character Extension ID obtained from the Chrome Web Store dashboard.
- [ ] Click **Create**.
- [ ] Copy the generated Client ID (e.g. `48459272093-xxxxxxxx.apps.googleusercontent.com`).
- [ ] If this Client ID differs from what is currently in `manifest.json`, update `manifest.json`:
  ```json
  "oauth2": {
    "client_id": "YOUR_NEW_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive"
    ]
  }
  ```
  *(Re-create the zip and upload the updated package if needed).*

---

## Phase 4: Complete the Store Listing & Submit

Open your draft item in the Chrome Web Store Developer Dashboard and fill out the sections using `STORE_LISTING.md`:

### 4.1 Store Listing Tab
- [ ] **Description**: Copy the formatted description from `STORE_LISTING.md`.
- [ ] **Category**: Select **Productivity**.
- [ ] **Language**: Select **English**.
- [ ] **Graphic Assets**:
  - Upload Icon (128x128 px): `icons/icon128.png`.
  - Upload at least 1 Screenshot (1280x800 px).
  - Upload Small Promo Tile (440x280 px).

### 4.2 Privacy Tab
- [ ] **Single Purpose**:
  > "Convert and save currently opened Google Drive documents directly as PDF files into the same Google Drive folder."
- [ ] **Permission Justifications**:
  - `identity`: See `STORE_LISTING.md`.
  - `contextMenus`: See `STORE_LISTING.md`.
  - `activeTab`: See `STORE_LISTING.md`.
  - Host permissions: See `STORE_LISTING.md`.
- [ ] **Host Permissions Justification**: Copy justifications from `STORE_LISTING.md`.
- [ ] **User Data Policy**: Check the boxes confirming you do not sell data, use data for credit/lending, or violate Google's policies.
- [ ] **Privacy Policy URL**: Enter `https://tanmayshah2705.github.io/drive-pdf-saver/#privacy`.

### 4.3 Submit for Review
- [ ] Click **Submit for Review**.
- [ ] Review typically takes 1 to 3 business days for extensions using OAuth permissions.

---

## Phase 5: Post-Publication Verification

Once published:
- [ ] Install the extension directly from the Chrome Web Store link on a different computer / Google account.
- [ ] Open a Google Doc ➔ Right-click ➔ Click **"Save as PDF to Google Drive"**.
- [ ] Approve the Google Drive OAuth consent prompt.
- [ ] Confirm in-page toast shows success and the PDF appears in the same Google Drive folder.
- [ ] Confirm in-place updating works when triggered a second time.
