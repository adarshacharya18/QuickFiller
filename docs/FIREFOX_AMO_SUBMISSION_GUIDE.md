# Firefox AMO (addons.mozilla.org) Public Submission Guide

> Complete, step-by-step guide for publishing **QuickFiller** publicly to the official **Mozilla Firefox Add-ons Directory (AMO)** based on the official [Firefox Extension Workshop documentation](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/).

---

## 📦 1. Pre-Packaged Submission Files

Both required submission packages have been generated and are ready in your repository:

| Package | Path | Size | Purpose |
|:---|:---|:---|:---|
| **Extension ZIP** | [`.output/quickfiller-1.0.1-firefox.zip`](file:///home/adarsh/Documents/Projects/QuickFiller/.output/quickfiller-1.0.1-firefox.zip) | ~767 KB | Uploaded in **Step 2 (Upload Version)** |
| **Source Code ZIP** | [`.output/quickfiller-1.0.1-sources.zip`](file:///home/adarsh/Documents/Projects/QuickFiller/.output/quickfiller-1.0.1-sources.zip) | ~280 KB | Uploaded in **Step 3 (Source Code Submission)** |

> [!TIP]
> If you ever make changes to the code before submitting, regenerate both zip archives in one command:
> ```bash
> npm run zip:firefox
> ```

---

## 🚀 2. Step-by-Step AMO Submission Process

### Step 1: Create or Sign in to Mozilla Developer Hub
1. Go to the **[AMO Add-on Developer Hub](https://addons.mozilla.org/developers/)**.
2. Sign in with your **Mozilla Account** (or click Register).
   - *Note:* Mozilla requires **Two-Factor Authentication (2FA)** for developer accounts.
3. Accept the **Developer Agreement & Add-on Policies**.
4. Click the button: **"Submit a New Add-on"** (or **"Submit Your First Add-on"**).

---

### Step 2: Choose Distribution Option
On the **"Distribution"** page, you will see two choices:
- [x] **On this site** (*Recommended* — Lists your extension publicly on `addons.mozilla.org` so all Firefox users can search, find, and install it with automatic updates).
- [ ] On your own (*Self-distribution / unlisted*).

Select **"On this site"** and click **Continue**.

---

### Step 3: Upload the Extension File
1. Click **Select a file...**.
2. Browse to and upload:
   ```text
   /home/adarsh/Documents/Projects/QuickFiller/.output/quickfiller-1.0.1-firefox.zip
   ```
3. The automatic AMO validator will run a series of automated security, manifest, and compatibility checks.
4. When validation finishes with green success:
   - Compatible Platforms: Ensure **Firefox for Desktop** is checked.
5. Click **Continue**.

---

### Step 4: Submit Source Code (Mandatory for Review)
Because QuickFiller uses TypeScript, React, Vite, and WXT bundling, Mozilla reviewers require source code submission to verify that the distributed bundle matches the open-source code.

1. When asked:  
   **"Does your add-on include code that might be difficult to read, such as code created by minification or obfuscation?"**  
   👉 Select **Yes**.
2. Click **Browse** and upload:
   ```text
   /home/adarsh/Documents/Projects/QuickFiller/.output/quickfiller-1.0.1-sources.zip
   ```
3. In the **"Instructions for Reviewer on how to build"** text box, paste:
   ```text
   Build Requirements & Instructions:
   1. Node.js version: v20.x or v22.x, npm v10+
   2. Unpack source zip, open terminal in the project directory.
   3. Install dependencies:
      npm install
   4. Build Firefox extension:
      npm run build:firefox
   5. The output files are generated in `.output/firefox-mv2/` and match the submitted extension zip.
   6. Third-Party Libraries & Linter Warnings:
      - The innerHTML warnings originate from React DOM (react-dom) core JSX runtime. No custom innerHTML is used in application code.
      - The Function constructor (eval) and dynamic import warnings originate from Mozilla's official `pdfjs-dist` (PDF.js) library used for client-side resume parsing.
   7. Repository: https://github.com/adarshacharya18/QuickFiller
   ```
4. Click **Continue**.

---

### Step 5: Describe Your Add-on (Listing Details)

Copy and paste the exact metadata below into the listing form:

#### 1. Name
```text
QuickFiller - App Copilot
```

#### 2. Add-on URL
Leave default or edit to:
```text
quickfiller
```
*(Your public listing will be available at `https://addons.mozilla.org/firefox/addon/quickfiller/`)*

#### 3. Summary (Short Description)
```text
100% local-first smart job application copilot, autofill engine, and AI cover letter writer.
```

#### 4. Detailed Description
```text
⚡ QuickFiller: The 100% Local-First Job Application Copilot & Autofill Assistant

Tired of repeatedly typing your contact information, work experience, and custom answers across dozens of job applications? QuickFiller transforms the hiring application process into a fast, private, and effortless workflow.

🔒 100% LOCAL-FIRST & PRIVACY-OBSESSED
Unlike cloud-based autofill extensions that send your resume, address, phone number, and salary expectations to third-party databases, QuickFiller stores 100% of your data locally in your browser's private storage (chrome.storage.local).
• Zero analytics, telemetry, or user tracking
• Zero developer backend servers
• Your personal profile never leaves your computer

🦙 DUAL AI ENGINE: RUN 100% OFFLINE WITH OLLAMA
QuickFiller is designed from the ground up for local AI:
• 100% Local AI: Connect directly to Ollama running on your machine (llama3.2, mistral, qwen2.5) for free, private AI assistance.
• Bring-Your-Own-Key (BYOK) Cloud AI: Optionally connect Google Gemini, OpenAI (GPT-4o), or Anthropic Claude using your personal API key.

📄 DEEP RESUME & LINK HARVESTER
• Drag-and-drop your PDF resume to instantly extract contact details, work history, education, and technical competencies.
• Hyperlink Extraction: Automatically harvests links from your resume (GitHub, portfolio, live demos) so AI answers cite real work.

🎯 THE SMART COPILOT DRAWER
• 1-Click Autofill: Populates Name, Email, Phone, Extension, Address, LinkedIn, and GitHub in one click.
• AI Screening Question Answerer: Drafts tailored responses for tricky behavioral questions ("Why do you want to work here?", "Describe a technical challenge").
• 1-Click Field Insertion: Safely injects text into active fields across modern single-page apps (React, Angular, Vue) without breaking form validation.
• Radio Button & Dropdown Resolver: Intelligently selects work authorization, notice period, and sponsorship options.

💼 AUTOMATIC JOB TRACKER & CANDIDATE PORTAL DETECTOR
• Auto-Detects Submissions: Automatically logs applied jobs with company names, dates, and clean posting links across Workday, Greenhouse, Lever, SmartRecruiters, Darwinbox, CRISIL, and more.
• Candidate Portal Detection: Detects tracking portal links (such as Workday Candidate Home, Greenhouse my.greenhouse.io) so you can track your status anytime.

🛡️ OPEN SOURCE & TRANSPARENT
QuickFiller is open-source under the MIT License:
• Source Code: https://github.com/adarshacharya18/QuickFiller
• Privacy Policy: https://github.com/adarshacharya18/QuickFiller/blob/main/PRIVACY_POLICY.md
```

#### 5. Categories
- Primary Category: **Productivity**
- Secondary Category: **Search Tools** (or **Photos, Music & Media**)

#### 6. Support Email & Support Website
- Support Website: `https://github.com/adarshacharya18/QuickFiller`
- Support Email: *(Your developer contact email)*

#### 7. License
- Select: **MIT License**

#### 8. Privacy Policy
Check **"This add-on has a privacy policy"** and paste:
```text
https://github.com/adarshacharya18/QuickFiller/blob/main/PRIVACY_POLICY.md
```
*(Or paste the full text from PRIVACY_POLICY.md)*

#### 9. Notes for Reviewers
Paste this into the **Notes for Reviewers** box to expedite manual review:
```text
QuickFiller is a 100% local-first job application copilot that stores candidate profile details in browser local storage and helps autofill job application forms.

Testing without external accounts:
1. Load the extension.
2. Open the included offline test forms directly in Firefox:
   - file:///path/to/QuickFiller/test-form.html (Standard inputs & screening questions)
   - file:///path/to/QuickFiller/workday-test-app.html (Workday multi-step simulation)
   - file:///path/to/QuickFiller/darwinbox-test-app.html (Web component simulation)
3. Click the floating "[QuickFiller]" badge in the bottom-right corner or press Alt+Shift+Q to open the Copilot Drawer.
4. Click "Fill All Standard" to verify autofill functionality.

Network / AI Privacy:
- QuickFiller does not transmit any user data to any developer server.
- AI features are 100% BYOK (Bring-Your-Own-Key) or run completely offline via user-installed Ollama on http://localhost:11434.

Linter Warnings Note:
- innerHTML warnings are internal to the React DOM / JSX runtime.
- The Function constructor and dynamic import warnings are internal to Mozilla's official pdfjs-dist library used for local PDF resume parsing.
```

---

### Step 6: Submit Version
Click the blue **"Submit Version"** button at the bottom of the page!

---

## ⏳ 3. What Happens After Submission?

1. **Automatic Static Analysis:** Runs immediately and validates manifest and code patterns.
2. **Human Review Queue:** Mozilla add-on reviewers review new extensions. Because QuickFiller is open-source, provides reproduction build steps, and includes offline test pages, review is straightforward.
3. **Approval Notification:** You will receive an email confirmation once approved (typically within 24 to 72 hours).
4. **Live URL:** Your extension will be publicly live at:
   ```text
   https://addons.mozilla.org/firefox/addon/quickfiller/
   ```
   Any Firefox user can click **"Add to Firefox"** to install it.
