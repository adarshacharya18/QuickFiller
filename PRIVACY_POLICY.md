# Privacy Policy for QuickFiller

**Last Updated:** September 14, 2026  
**Extension Name:** QuickFiller - Local-First Job Application Copilot  
**Developer Contact:** `quickfiller@adarshacharya.dev`  
**Repository:** [https://github.com/adarshacharya18/QuickFiller](https://github.com/adarshacharya18/QuickFiller)

---

## 1. Introduction & Core Privacy Principle

QuickFiller is an open-source, local-first browser extension designed to help job seekers autofill standard application inputs, contextually draft screening answers, generate tailored cover letters, and track job applications across applicant tracking systems (ATS).

**Our Core Privacy Principle:**  
**QuickFiller operates 100% on your local machine. We do not own, operate, or maintain any backend servers that collect, store, or process your personal data. Your resume, personal information, job applications, and API keys remain strictly under your control.**

---

## 2. What Information We Handle

QuickFiller handles the following categories of data solely within your browser's local sandbox:

1. **Candidate Profile Information:**
   - Personal details (Full name, email address, phone number, location, LinkedIn URL, GitHub URL, portfolio URL).
   - Work experience, education history, and skills extracted from your resume PDF or manually entered.
   - Answers to common job application screening questions (e.g., work authorization, notice period, compensation expectations).
2. **Job Application & Tracking Data:**
   - Company name, job title, job URL, application status (Applied, Interviewing, Offered, Rejected), submission timestamp, and application portal links.
3. **Custom Snippets & Paste Bank:**
   - Text snippets and pre-saved responses you explicitly save for repetitive application fields.
4. **AI & LLM Configuration Settings:**
   - User-configured AI provider selections, model names, local endpoints (e.g., `http://localhost:11434` for Ollama), and user-provided API keys (Google Gemini, OpenAI, Anthropic Claude).

---

## 3. How Your Data Is Stored & Protected

- **Protected Browser Storage (`chrome.storage.local`):**  
  All profile details, resume data, screening answers, and job tracking records are stored exclusively inside Chromium's isolated extension storage sandbox (`chrome.storage.local`).
- **No Third-Party Web Access:**  
  Websites you visit cannot access or inspect your QuickFiller extension storage. QuickFiller includes explicit origin boundary guards that prevent candidate data from being read or written to web document `localStorage`.
- **Zero Remote Analytics or Telemetry:**  
  QuickFiller does **not** integrate any third-party tracking scripts, analytics SDKs (such as Google Analytics or Mixpanel), advertising trackers, or telemetry beacons.
- **Zero Remote Developer Servers:**  
  There is no developer server, database, or API associated with QuickFiller.

---

## 4. Third-Party AI Services & Data Transmission

QuickFiller supports a **dual-engine AI architecture** for answer drafting and cover letter generation:

### A. Local AI Mode (Ollama) — 100% Offline
- When using **Ollama**, all prompts, job descriptions, and profile context are transmitted solely to your own machine via `http://localhost:11434`.
- **Zero data leaves your computer.** You can use QuickFiller completely offline with local open-weight models (`llama3.2`, `mistral`, `qwen2.5`, etc.).

### B. Cloud AI Providers (Google Gemini, OpenAI, Anthropic) — Bring-Your-Own-Key (BYOK)
- If you explicitly choose to use a cloud AI provider and enter your own personal API key:
  - QuickFiller only sends requests to the official provider endpoints (`generativelanguage.googleapis.com`, `api.openai.com`, or `api.anthropic.com`) when you explicitly click **"Draft Answer"** or **"Generate Cover Letter"**.
  - Only the relevant profile context and job description necessary to fulfill that specific prompt are transmitted.
  - Your API keys are stored locally in `chrome.storage.local` and never sent to any intermediary server.
  - Data sent to these providers is governed by the respective provider's privacy policy:
    - [Google Gemini API Privacy Notice](https://policies.google.com/privacy)
    - [OpenAI Privacy Policy](https://openai.com/privacy)
    - [Anthropic Privacy Policy](https://www.anthropic.com/privacy)

---

## 5. Permissions Used and Why

QuickFiller requests only the minimum permissions necessary to function:

| Permission | Purpose |
| :--- | :--- |
| `storage` | To store your candidate profile, screening Q&A bank, custom snippets, and job application records locally on your device. |
| `activeTab` | To detect form fields, read the job title/description, and autofill inputs on the active tab upon your request. |
| `scripting` | To inject the isolated Copilot Drawer into already open tabs when you activate the extension. |
| `declarativeNetRequest` | To safely modify request headers for connections to your local Ollama instance (`localhost:11434`) without exposing local ports to third-party web origins. |
| `host_permissions` (`<all_urls>`) | Required because job applications and ATS forms (Workday, Greenhouse, Lever, SmartRecruiters, Darwinbox, etc.) are hosted across thousands of unknown company domains and subdomains. QuickFiller only activates on pages where you open the drawer or trigger autofill. |

---

## 6. Google Chrome Web Store Limited Use Disclosure

QuickFiller strictly adheres to the [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/), including the **Limited Use** requirements:
1. QuickFiller will not use or transfer user data for serving personalized, re-targeted, or interest-based advertising.
2. QuickFiller will not transfer user data to third parties, except as explicitly directed by the user when sending prompts to the user's selected AI provider.
3. QuickFiller does not sell user data to any third party under any circumstances.
4. QuickFiller does not use or transfer user data to determine creditworthiness or for lending purposes.

---

## 7. Your Data Rights & Deletion

Because all your data is stored locally on your device:
- **Export / View Data:** You can view, edit, or copy your profile, answers, and applications at any time via the **Options** page.
- **Delete Data:** You can clear any individual data field, delete specific tracked jobs, or uninstall the extension at any time. Uninstalling QuickFiller from Chrome instantly and permanently purges all local extension storage from your machine.

---

## 8. Changes to This Privacy Policy

We may update this Privacy Policy periodically to reflect changes in our features, legal standards, or browser store requirements. Any updates will be posted in this repository with an updated revision date.

---

## 9. Contact & Support

If you have questions or concerns regarding this Privacy Policy or QuickFiller's security practices, please open an issue on GitHub or reach out to:

- **Developer:** Adarsh Acharya  
- **Email:** `quickfiller@adarshacharya.dev`  
- **GitHub Issues:** [https://github.com/adarshacharya18/QuickFiller/issues](https://github.com/adarshacharya18/QuickFiller/issues)
