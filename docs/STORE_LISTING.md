# Chrome Web Store Listing Copy & Submission Kit

This file contains the exact copy, structured plain-text description, and permission justification statements ready to be pasted directly into the **Chrome Web Store Developer Console** during the submission process.

---

## 1. Store Listing Overview

| Field | Value / Constraint | Actual Character Count |
|:---|:---|:---|
| **Item Name** | `QuickFiller - Local-First Job Application Copilot` | **50 / 75 chars** |
| **Summary / Short Description** | `Smart job application autofill and copilot powered by local Ollama & cloud LLMs.` | **82 / 132 chars** |
| **Primary Category** | **Productivity** | Dropdown selection |
| **Secondary Category** | **Workflow & Planning** (or **Tools**) | Dropdown selection |
| **Language** | **English** | Dropdown selection |
| **Version** | `1.0.0` | In manifest |
| **Pricing** | **Free** | No in-app purchases |

---

## 2. Detailed Description (Paste into "Detailed Description" box)

```text
⚡ QuickFiller: The 100% Local-First Job Application Copilot & Autofill Assistant

Tired of manually filling out the same repetitive personal details, work history, and custom screening questions on every single job application?

QuickFiller transforms the job application experience into a fast, stress-free workflow. It combines high-accuracy 1-click autofill with an intelligent in-page Copilot Drawer powered by local or cloud AI.

🔒 100% LOCAL-FIRST & PRIVACY-OBSESSED
Unlike traditional autofill extensions that upload your sensitive resume, phone number, work history, and salary expectations to external cloud databases, QuickFiller stores 100% of your data locally in your browser sandbox (chrome.storage.local).
• Zero analytics or telemetry
• Zero developer backend servers
• Your personal information never leaves your machine

🦙 DUAL AI ENGINE: RUN 100% OFFLINE WITH OLLAMA
QuickFiller is the first job copilot built for local AI:
• Native Local AI: Connect directly to local Ollama models (llama3.2, mistral, qwen2.5) with zero cloud fees and 100% offline privacy.
• Bring-Your-Own-Key (BYOK) Cloud AI: Prefer cloud models? Connect Google Gemini Flash, OpenAI (GPT-4o), or Anthropic Claude using your personal API key.

📄 DEEP RESUME & LINK HARVESTER
• Drag-and-drop your PDF resume to instantly extract contact information, work experience, education, and technical skills.
• Embedded Link Extraction: Extracts embedded hyperlink annotations from your PDF (portfolio, GitHub repositories, live demo links) so your AI drafts cite real projects.

🎯 THE SMART COPILOT DRAWER
When you land on any job application, the lightweight QuickFiller Copilot Drawer slides out seamlessly in an isolated Shadow DOM (zero page styling conflicts):
• 1-Click Autofill: Populates First Name, Last Name, Email, Phone, LinkedIn, GitHub, and Portfolio in one click.
• AI Screening Question Answerer: Generates tailored, high-impact drafts for tricky behavioral questions ("Why do you want to work here?", "Describe a challenge you overcame").
• 1-Click Field Insertion: Click "Insert" to inject answers directly into active form inputs without breaking React or Angular state.
• Instant Clipboard Copy: 1-click copy for manual pasting anywhere.

💼 AUTOMATIC JOB TRACKER & CANDIDATE PORTAL DETECTOR
• Auto-Detects Submissions: Automatically logs applied jobs with timestamps and company details.
• Portal URL Scanner: Scans confirmation pages and detects candidate portal tracking links (Workday, SmartRecruiters, Darwinbox, etc.) so you can check your application status later.
• Full Application Dashboard: Track Applied, Interviewing, Offered, and Rejected statuses from your Options dashboard.

📋 CUSTOM PASTE BANK
Save your frequent responses (work authorization, notice period, salary expectations, custom links) for 1-click insertion on any form.

🛡️ PERMISSIONS & TRANSPARENCY
QuickFiller is fully open-source and operates under the MIT License.
Repository: https://github.com/adarshacharya18/QuickFiller
Privacy Policy: https://github.com/adarshacharya18/QuickFiller/blob/main/PRIVACY_POLICY.md
```

---

## 3. Privacy Practices Tab (Copy-Paste Answers)

### Single Purpose Description
> `QuickFiller is an intelligent job application copilot that helps candidates autofill job forms, draft screening answers using local or cloud AI, and track job applications.`

### Permission Justifications (For Reviewers)

#### `storage`
> `QuickFiller stores the candidate's personal profile (contact information, work history, education), common screening question answers, custom text snippets, and job tracking records locally on the user's device using chrome.storage.local. No personal data is ever transmitted to any developer-hosted server.`

#### `activeTab`
> `Required to detect form fields, read the job title and description, and autofill inputs on the user's active job application tab when the user explicitly clicks the extension icon or uses the keyboard shortcut.`

#### `scripting`
> `Allows the extension to inject the content script and isolated Shadow DOM copilot drawer dynamically into pre-existing open job application tabs when the extension is installed or reloaded, ensuring the user does not have to manually refresh open pages.`

#### `declarativeNetRequest`
> `Allows QuickFiller to safely rewrite the Origin header on requests sent to the user's local Ollama instance (http://localhost:11434), enabling private, local AI generation without exposing local ports to third-party web origins.`

#### `host_permissions` (`<all_urls>`)
> `Job applications and ATS forms are hosted on tens of thousands of disparate company websites, career subdomains, and third-party portals (such as Workday, Greenhouse, Lever, SmartRecruiters, Darwinbox, and custom internal ATSs). In order to detect job forms, autofill fields, and assist candidates on any employer website where they apply, broad host permissions are necessary. QuickFiller only activates its interactive drawer upon candidate interaction and never injects remote scripts or tracks user browsing.`

---

## 4. Data Usage Disclosures

Under the **Data usage** section of the Privacy tab:

1. Select **Personal identification information** (Name, address, email, phone, employment history).
2. Check the declarations:
   - ✅ **"This data is NOT sold to third parties."**
   - ✅ **"This data is NOT used or transferred for purposes that are unrelated to the item's core functionality."**
   - ✅ **"This data is NOT used or transferred to determine creditworthiness or for lending purposes."**
3. In the Privacy Policy URL field:
   - Provide your public HTTPS link (e.g. `https://github.com/adarshacharya18/QuickFiller/blob/main/PRIVACY_POLICY.md` or your GitHub Pages link).

---

## 5. Store Listing Promotional Screenshots (`public/Screenshots/`)

The extension promotional screenshots are organized and numbered in `public/Screenshots/` ready for upload to Chrome Web Store and Firefox Add-ons (AMO):

| Filename | Caption / Description | Section |
| :--- | :--- | :--- |
| `01-copilot-drawer-autofill.png` | **In-Page Copilot Drawer**: 1-Click Autofill, detected candidate fields, and AI screening question drafting on Workday. | In-Page Overlay |
| `02-copilot-drawer-cover-letter.png` | **Tailored Cover Letter Generator**: Scrapes active JD, customizes tone and word count, and generates tailored pitches. | Copilot Tool |
| `03-copilot-drawer-outreach-studio.png` | **Outreach Studio**: Refines connection notes and InMail pitches tailored for Recruiters vs Engineering Leads. | Copilot Tool |
| `04-copilot-drawer-paste-bank.png` | **Custom Paste Bank**: 1-click insertion for work authorization, salary, relocation, and frequently used answers. | Copilot Tool |
| `05-job-tracker-dashboard.png` | **Job Application Tracker**: 100% local dashboard tracking applied roles, interview rates, and candidate portal links. | Management Hub |
| `06-candidate-profile-contact-details.png` | **Candidate Profile & Resume Parser**: Local PDF resume parsing for biographical, contact, and social links. | Management Hub |
| `07-candidate-profile-experience-education.png` | **Work Experience & Portfolio Projects**: Structured career timeline and project achievements grounding AI generation. | Management Hub |
| `08-screening-qa-and-paste-bank.png` | **Screening Q&A & Reusable Snippets**: Standard screening wizard, approved Q&A bank, and custom paste presets. | Management Hub |
| `09-ai-settings-llm-configuration.png` | **LLM Engine Configuration**: Seamless toggle between 100% offline local Ollama and BYOK cloud LLMs. | Settings & Privacy |

