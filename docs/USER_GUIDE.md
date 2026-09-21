# QuickFiller End-User Guide & Copilot Manual

> Your complete walkthrough for mastering QuickFiller: the 100% local-first job application copilot, resume harvester, and AI message refiner.

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Installation & Setup](#2-installation--setup)
3. [AI Engine Configuration (Local Ollama vs Cloud BYOK)](#3-ai-engine-configuration)
4. [Setting Up Your Candidate Profile](#4-setting-up-your-candidate-profile)
5. [Pre-Screen Wizard & Custom Question Bank](#5-pre-screen-wizard--custom-question-bank)
6. [Using the Copilot Drawer on Job Applications](#6-using-the-copilot-drawer-on-job-applications)
   - [1-Click Standard Autofill & Radio Resolution](#1-click-standard-autofill--radio-resolution)
   - [AI Screening Question Drafting & 1-Click Insert](#ai-screening-question-drafting--1-click-insert)
   - [Tailored Cover Letter Generator](#tailored-cover-letter-generator)
   - [Draggable & Dockable Floating Window](#draggable--dockable-floating-window)
7. [Outreach Message Refiner (LinkedIn & Non-Job Pages)](#7-outreach-message-refiner)
8. [Automated Job Application Tracker & CSV Export](#8-automated-job-application-tracker--csv-export)
9. [Custom Paste Bank](#9-custom-paste-bank)
10. [Troubleshooting & FAQs](#10-troubleshooting--faqs)

---

## 1. Introduction

QuickFiller is designed around one core belief: **your private job search data belongs only to you**. Unlike commercial extensions that store your resumes, phone numbers, and compensation history on third-party servers, QuickFiller executes 100% locally in your browser sandbox (`chrome.storage.local`).

With QuickFiller, you can:
- Autofill complex multi-step application wizards across **Workday, Darwinbox, CRISIL, Greenhouse, Lever, Google Forms, and Microsoft Forms** without breaking React/Angular state.
- Generate context-aware AI responses to custom screening questions and draft tailored cover letters using a local Ollama model or your own cloud API key.
- Refine cold outreach messages directly into **LinkedIn message popups** with recruiter or technical personas.
- Automatically track your submitted applications and candidate portal URLs.

---

## 2. Installation & Setup

### For Google Chrome & Chromium Browsers (Brave, Edge, Arc)
1. **Download or Clone the Repository**:
   ```bash
   git clone https://github.com/adarshacharya18/QuickFiller.git
   cd QuickFiller
   npm install
   npm run build
   ```
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked**.
5. Select the `.output/chrome-mv3` folder inside your project directory.
6. Click the puzzle icon in Chrome's toolbar and **Pin** QuickFiller for easy access!

### For Mozilla Firefox
1. Run the Firefox build command:
   ```bash
   npm run build:firefox
   ```
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select any file inside `.output/firefox-mv2` (e.g. `manifest.json`).

---

## 3. AI Engine Configuration

QuickFiller supports a **Dual AI Engine**. Choose between running 100% offline with zero cost or connecting your preferred cloud LLM.

Navigate to **Options** $\rightarrow$ **Settings** tab.

### Option A: Local AI with Ollama (Recommended for 100% Privacy)
1. Install [Ollama](https://ollama.com/) on your workstation.
2. Pull a lightweight model (e.g., Llama 3.2 or Qwen 2.5):
   ```bash
   ollama run llama3.2:3b
   ```
3. In QuickFiller Settings:
   - Select **Ollama (Local)** as the Active Provider.
   - Host URL: `http://localhost:11434`
   - Click **Test Connection & Refresh Models**. QuickFiller automatically configures Declarative Net Request rules to eliminate CORS issues.
   - Select your installed model from the dropdown.

### Option B: Cloud AI (Bring-Your-Own-Key)
If you prefer cloud models, QuickFiller supports direct client-to-API communication with zero intermediate proxy servers:
- **Google Gemini**: Enter your Google AI Studio API key (`gemini-1.5-flash`).
- **OpenAI**: Enter your OpenAI API key (`gpt-4o-mini`).
- **Anthropic**: Enter your Anthropic API key (`claude-3-5-haiku-20241022`).

All keys are stored securely inside your local browser storage and are never transmitted elsewhere.

---

## 4. Setting Up Your Candidate Profile

1. Open the QuickFiller Options Dashboard by clicking the extension icon $\rightarrow$ **Open Profile & Settings** (or right-click extension $\rightarrow$ Options).
2. Under the **Profile** tab, you have two options:
   - **Upload Resume (PDF)**: Drag and drop your existing PDF resume. QuickFiller's client-side PDF parser extracts your contact info, experience, education, skills, and **embedded hyperlink annotations** (GitHub repos, portfolio links, demo projects).
   - **Manual Editing**: Fill in your First Name, Last Name, Email, Phone Number, Phone Extension, Location, and URLs (LinkedIn, GitHub, Portfolio).
3. Review and refine your Work Experience, Projects, and Education sections. These details provide the ground truth context for the AI when answering custom application questions.

---

## 5. Pre-Screen Wizard & Custom Question Bank

### Pre-Screen Legal Wizard
Most enterprise ATS platforms ask repetitive compliance questions. Pre-configure your answers in the **Questions & Bank** tab:
- **Work Authorization**: Authorized to work? (Yes/No)
- **Visa Sponsorship**: Do you now or in the future require sponsorship? (No/Yes)
- **Notice Period**: e.g., "Immediate", "2 weeks", "30 days"
- **Desired Compensation**: e.g., "$120,000 - $140,000 USD" or "Market Rate / Negotiable"
- **Relocation Preference**: "Remote Only", "Yes", or "No"
- **Voluntary Disclosures**: Gender, Veteran status, Disability disclosures.

### Custom Q&A Bank
Store your polished answers to common behavioral prompts:
- *"Describe a difficult engineering challenge you solved."*
- *"Why are you interested in joining our company?"*
- *"Explain a time you managed cross-functional conflict."*

---

## 6. Using the Copilot Drawer on Job Applications

When you navigate to any job application page, QuickFiller displays a floating launcher badge in the bottom-right corner. You can also press `Alt + Shift + Q` to toggle the drawer at any time.

```
+-------------------------------------------------------------+
| [=] QuickFiller Copilot     [__] [-] [X]                     |
| [Autofill & Questions] [Cover Letter] [Outreach] [Paste Bank] |
+-------------------------------------------------------------+
| Filter: [All] [Questions] [Standard Inputs] [Radios]        |
|                                                             |
| [*] Standard Fields (8 detected)           [Fill All Standard]
|   - First Name: "Adarsh"                     [Fill] [Copy]   |
|   - Last Name: "Acharya"                    [Fill] [Copy]   |
|   - Phone Number: "+1 555-0199"             [Fill] [Copy]   |
|   - Phone Extension: "104"                  [Fill] [Copy]   |
|                                                             |
| [?] Custom Questions (2 detected)          [Answer All AI]  |
|   Prompt: "Why are you interested in this role?"            |
|   [Draft Answer with AI] [Regenerate] [Insert] [Copy]       |
+-------------------------------------------------------------+
```

### 1-Click Standard Autofill & Radio Resolution
- Click **Fill All Standard** to populate all recognized biographical fields at once.
- Specialized handlers ensure Phone Number and Phone Extension are correctly separated on Workday and enterprise portals.
- Radio buttons and checkboxes for work authorization, notice period, and sponsorship are resolved automatically based on your Wizard settings.

### AI Screening Question Drafting & 1-Click Insert
- Click **Draft Answer** next to any screening question. QuickFiller combines the job context, question prompt, your profile, and paste bank into a prompt for your configured LLM.
- Use **Add specific notes** if you want to emphasize a particular project or technical skill.
- Click **Insert** to inject the answer directly into the active field, or **Copy** to copy it to your clipboard.

### Tailored Cover Letter Generator
1. Switch to the **Cover Letter** tab inside the drawer.
2. QuickFiller automatically scrapes the job title, company name, and job description from the current page.
3. Select your desired **Tone** (*Professional*, *Enthusiastic*, *Concise*) and **Focus Area** (*Technical*, *Leadership*, *Culture*).
4. Click **Generate Cover Letter**. QuickFiller produces a tailored letter referencing your actual projects and experience.
5. Click **Insert** to place it into the ATS cover letter field, or **Copy** to clipboard.

### Draggable & Dockable Floating Window
- **Drag Handle**: Click and drag the top header bar to position the Copilot window anywhere on your screen.
- **Position Memory**: QuickFiller remembers where you moved the window during your browsing session.
- **Reset Position**: Click the target/pin icon (`LocateFixed`) to reset the window back to its default bottom-right docked position.
- **Width Toggle**: Click the expand/collapse icon (`Maximize2` / `Minimize2`) to switch between compact (420px) and wide (640px) reading modes.

---

## 7. Outreach Message Refiner

When you're browsing LinkedIn, company team pages, or GitHub profiles and want to reach out to a recruiter or engineering manager:

1. Click the QuickFiller extension icon or open the Copilot Drawer and select the **Outreach** tab.
2. Enter your draft or bullet points in the input box.
3. Select your **Target Persona**:
   - **Recruiter**: Generates crisp, metric-driven pitches emphasizing immediate availability, core skills, and role alignment.
   - **Technical Lead**: Generates peer-to-peer messages highlighting engineering paradigms, GitHub repos, and specific architecture experience.
4. Add any optional context notes (e.g., "Mentioned distributed systems project").
5. Click **Refine Message**.
6. QuickFiller produces two outputs simultaneously:
   - **LinkedIn Connection Note**: Strictly enforced to ≤ 300 characters for LinkedIn connection requests.
   - **Full InMail / Email Pitch**: 100–180 word comprehensive introductory pitch.
7. Click **Insert into Message Box** to paste the generated note directly into your active LinkedIn chat popup or email window!

---

## 8. Automated Job Application Tracker & CSV Export

QuickFiller monitors your application flow automatically:

### How Automatic Tracking Works
- When you click a submit button (identified by `data-testid`, `data-automation-id`, or standard submit types), QuickFiller captures the current company, job title, and URL.
- When the portal navigates to a confirmation route (`/confirm`, `/jobconfirm`, `/submitted`, `/thank-you`) or displays a confirmation banner (e.g. `<app-jobconfirm>` or *"Thank You - profile submitted"*), QuickFiller records the application in `storage.applications`.
- It also scans the page for your **Candidate Portal Home URL** (e.g. Workday Candidate Home), allowing you to return and check your status later.

### Managing Tracked Applications
Open **Options** $\rightarrow$ **Applications** tab:
- Filter applications by status: **Bookmarked**, **Applied**, **Interviewing**, **Offer**, **Rejected**.
- Search applications by company name or job title.
- Update status, add interview notes, and log salary numbers.
- Click **Export CSV** to download a clean spreadsheet of your entire job search history for use in Excel or Google Sheets.

---

## 9. Custom Paste Bank

In **Options** $\rightarrow$ **Questions & Bank** (or the **Paste Bank** tab in the Drawer):
- Add frequently used text snippets:
  - Custom portfolio links, GitHub repositories, live demo URLs
  - Preferred notice period text
  - Custom visa status explanations
  - Diversity statements
- Click any item in the drawer's Paste Bank to instantly copy or insert it into the focused input field.

---

## 10. Troubleshooting & FAQs

### Why is Ollama returning "Connection Failed" or 403 Forbidden?
- Ensure Ollama is running in your terminal: `ollama serve` or `ollama run llama3.2:3b`.
- QuickFiller dynamically configures Chrome Declarative Net Request rules to allow communication with `http://localhost:11434`. In rare cases where a custom port or origin is used, verify your host URL in **Settings** and click **Test Connection**.

### Why did a React or Angular form field clear itself after autofilling?
- QuickFiller uses prototype-level property setter dispatching combined with `input`, `change`, and `blur` events to ensure React and Angular synthetic event listeners pick up the changes. If a site uses custom masked inputs, click **Copy** next to the field in the Copilot Drawer and paste manually.

### Does QuickFiller track my browsing or upload my resume?
- **No.** QuickFiller contains 0 analytics scripts, 0 telemetry beacons, and 0 remote database connections. All data stays in `chrome.storage.local`. When using Ollama, your prompts and resumes never leave your machine. When using BYOK cloud providers, prompts are sent directly from your browser to Google, OpenAI, or Anthropic using your personal key.
