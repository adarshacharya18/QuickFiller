# ⚡ QuickFiller

> **A 100% local-first, privacy-obsessed job application copilot, smart autofill engine, and AI outreach refiner for Chromium & Firefox.**  
> Powered by local AI (**Ollama**) or Bring-Your-Own-Key cloud LLMs (**Google Gemini, OpenAI, Anthropic Claude**).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests: 250 passing](https://img.shields.io/badge/Tests-250%20passing-brightgreen.svg)](tests/)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](tsconfig.json)
[![Manifest: V3 & V2](https://img.shields.io/badge/Manifest-MV3%20%7C%20MV2-purple.svg)](wxt.config.ts)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-success.svg)](PRIVACY_POLICY.md)

---

## 🌟 Why QuickFiller?

Job searching is notoriously repetitive. Candidates fill out the exact same personal details, work histories, compensation requirements, and screening questionnaires dozens of times. Most existing autofill tools suffer from two critical flaws:

1. **Privacy Nightmare**: They upload your sensitive resumes, personal phone numbers, home addresses, and compensation history to external proprietary cloud databases.
2. **Fragile on Modern ATS Platforms**: Multi-step enterprise application wizards (**Workday, Darwinbox, CRISIL, Greenhouse, Lever, Google Forms, Microsoft Forms**) break traditional browser autofill. React and Angular virtual DOMs discard injected values on blur, phone extension fields get polluted by phone numbers, and tricky screening questions still demand manual writing.

### QuickFiller Solves Both:
- **🔒 100% Local-First & Zero Telemetry**: All data (profile, parsed resume, Q&A bank, custom paste snippets, application history) stays strictly inside your browser sandbox (`chrome.storage.local`). Zero analytics, zero tracking beacons, zero developer servers.
- **🦙 Dual AI Engine (Offline Ollama + Cloud BYOK)**: Run zero-cost inference 100% offline via **Ollama** (`llama3.2`, `mistral`, `qwen2.5`) with automated Declarative Net Request (DNR) CORS rewriting. Or connect your own API key for Google Gemini Flash, OpenAI GPT-4o-mini, or Anthropic Claude.
- **🎯 Resilient Copilot Drawer inside Shadow DOM**: Rendered inside an isolated `attachShadow({ mode: 'open' })` container with zero page CSS bleeding. Fully **draggable & dockable**, with position memory and expandable reading modes.
- **⚡ Prototype-Level Synthetic Autofill**: Bypasses React, Angular, and Vue virtual DOM state traps by calling native property descriptors and dispatching complete synthetic event sequences.
- **✉️ Outreach Message Refiner**: Refines cold outreach notes directly on LinkedIn or any web page. Produces character-limited LinkedIn connection requests (≤ 300 chars) and structured InMail/email pitches for Recruiters or Engineering Leads with 1-click insertion into LinkedIn message popups.
- **📊 Automatic Job Application Tracker**: Auto-detects submissions on Workday, CRISIL, Darwinbox, Greenhouse, Lever, and web forms; extracts candidate tracking portal URLs; and logs applications into an exportable dashboard.
- **📄 Client-Side PDF Resume & Link Harvester**: Extracts biographical text and embedded PDF hyperlink annotations (portfolio links, GitHub repos, live projects) so AI drafts cite your actual work.

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **Unified Autofill & AI Questions** | Single unified view combining Standard Fields, Custom Screening Questions, and Radio Groups with quick filter pills (`All`, `Questions`, `Standard`, `Radios`). |
| **Draggable Floating Window** | Drag the Copilot window anywhere on your screen via header grab handle. Remembers custom coordinates in `sessionStorage` with instant reset-to-dock button. |
| **Outreach Message Refiner** | Refines candidate pitches for **Recruiter** (availability, metrics) or **Technical Lead** (architecture, GitHub repos). 1-click insertion into LinkedIn messages. |
| **Automated Job Tracker** | Intercepts submit button clicks (`data-testid`, `data-automation-id`), detects confirmation routes (`/confirm`, `/jobconfirm`, `submitted`, `thank-you`), and saves candidate portal URLs. |
| **Tailored Cover Letter Generator** | Scrapes job titles and descriptions from active postings or linked tabs and drafts letters tailored by Tone (*Professional*, *Enthusiastic*, *Concise*) and Focus (*Technical*, *Leadership*). |
| **Deep ATS Support** | Specialized engine for **Workday** (phone extension separation, custom dropdowns), **Darwinbox**, **CRISIL / Angular SPAs**, **Google Forms**, and **Microsoft Forms**. |
| **Pre-Screen Legal Wizard** | One-click answers for work authorization, visa sponsorship, notice period, desired salary, relocation, and voluntary EEO disclosures. |
| **Custom Paste Bank** | Quick-access snippet bank for frequently requested portfolio links, diversity statements, or custom disclosures. |

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
- **Node.js** (v18+) or **Bun**
- *(Optional for 100% local AI)*: [Ollama](https://ollama.com/) running on your workstation:
  ```bash
  ollama run llama3.2:3b
  ```

### 2. Build the Extension
```bash
# Clone repository
git clone https://github.com/adarshacharya18/QuickFiller.git
cd QuickFiller

# Install dependencies
npm install

# Build for Chromium (Manifest V3)
npm run build

# Or build for Firefox (Manifest V2)
npm run build:firefox
```

The compiled extensions will output to:
- Chromium: `.output/chrome-mv3`
- Firefox: `.output/firefox-mv2`

### 3. Load in Google Chrome / Chromium Browsers
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `.output/chrome-mv3` directory.
5. Pin **QuickFiller** from the Chrome extensions menu (`Extensions` $\rightarrow$ pin `QuickFiller`).

### 4. Load in Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select any file inside `.output/firefox-mv2` (e.g., `manifest.json`).

---

## 🧪 Testing Locally

QuickFiller includes three realistic offline testing pages so you can test all features without applying on live job boards:

```bash
# Test standard forms & custom screening questions
google-chrome test-form.html

# Test Workday custom automation IDs, multi-step inputs & phone extensions
google-chrome workday-test-app.html

# Test Darwinbox candidate portal inputs & custom dropdowns
google-chrome darwinbox-test-app.html
```

### Verification Workflow:
1. Open `test-form.html` in Chrome.
2. Click the floating QuickFiller badge or press `Alt + Shift + Q` to open the Copilot Drawer.
3. Click **Fill All Standard** to populate Name, Email, Phone, and URLs.
4. Click **Draft Answer** on the custom questions to generate AI answers via Ollama or Cloud LLM.
5. Click **Insert** to inject the answer directly into the active field!

---

## 🏗️ Architecture & Project Map

```
QuickFiller/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts          # MV3 Service Worker (LLM router, DNR rules, SSRF shield)
│   │   ├── content/               # Content script injected into host pages
│   │   │   ├── index.tsx          # Isolated Shadow DOM mount point
│   │   │   ├── Drawer.tsx         # Draggable Copilot Drawer UI
│   │   │   └── styles.css         # Scoped Tailwind CSS
│   │   ├── options/               # Full-page Dashboard
│   │   │   ├── App.tsx            # Navigation shell
│   │   │   ├── ProfileTab.tsx     # PDF parser & candidate profile manager
│   │   │   ├── QuestionsTab.tsx   # Pre-screen wizard & Q&A bank
│   │   │   ├── ApplicationsTab.tsx# Job tracker & CSV exporter
│   │   │   └── SettingsTab.tsx    # Ollama & BYOK LLM manager
│   │   └── popup/                 # Toolbar action popup
│   ├── types/                     # TypeScript data contracts (profile, storage, LLM, outreach)
│   └── utils/
│       ├── autofill.ts            # Prototype-level synthetic event dispatcher
│       ├── scanner.ts             # Heuristic DOM scanner & job metadata scraper
│       ├── submissionWatcher.ts   # Interception engine for job submissions & confirmation routes
│       ├── radioResolver.ts       # Radio button & checkbox matcher
│       ├── phoneUtils.ts          # Phone number cleaner & extension parser
│       ├── jdResolver.ts          # Job description extractor for cover letters
│       ├── security.ts            # SSRF validation, secret masking, URL sanitization
│       ├── storage.ts             # Type-safe chrome.storage.local wrapper
│       └── llm/                   # Ollama, Gemini, OpenAI, Claude clients & prompt builders
├── docs/
│   ├── ARCHITECTURE.md            # In-depth C4 diagrams & system specifications
│   ├── API_REFERENCE.md           # Internal messaging protocols & utility API reference
│   ├── USER_GUIDE.md              # End-user walkthrough & copilot manual
│   ├── STORE_LISTING.md           # Chrome Web Store listing kit & permission justifications
│   └── ideas/                     # Product specifications & design notes
├── tests/                         # Vitest test suite (18 test files, 216 tests)
├── test-form.html                 # Mock standard application form
├── workday-test-app.html          # Mock Workday candidate portal form
├── darwinbox-test-app.html        # Mock Darwinbox candidate portal form
├── CHANGELOG.md                   # Full version history following Keep a Changelog
├── PRIVACY_POLICY.md              # Formal privacy disclosures & zero-data policy
├── wxt.config.ts                  # Web Extension Framework configuration
└── package.json
```

For in-depth technical details, see the [Architecture Documentation](docs/ARCHITECTURE.md) and [API Reference](docs/API_REFERENCE.md).

---

## 🛡️ Privacy & Security

QuickFiller adheres to a strict zero-trust, local-first security model:

1. **Zero External Servers**: No developer analytics, telemetry, or cloud databases.
2. **Local Storage**: All profile data, API keys, and job histories are confined to [`chrome.storage.local`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/storage.ts).
3. **SSRF Defense**: External job description fetching validates URLs against private IPv4/IPv6 ranges and loopback domains (`localhost`, `169.254.169.254`, `10.0.0.0/8`, etc.).
4. **Secret Redaction**: API keys and auth headers are automatically scrubbed from error traces.
5. **DNR Origin Isolation**: Ollama CORS header rules are dynamically bound strictly to the extension origin (`chrome-extension://<id>`).

Review our complete [Privacy Policy](PRIVACY_POLICY.md) for further details.

---

## 🧪 Testing & Quality Assurance

QuickFiller maintains a 100% test pass rate across 18 test suites:

```bash
# Run complete unit test suite
npm test

# Run tests in watch mode
npm run test:watch

# Verify TypeScript type checking
npm run compile

# Run security audit & SBOM generation
npm run security:audit
npm run security:sbom
```

---

## 📚 Documentation Index

- 📘 [User Guide & Copilot Manual](docs/USER_GUIDE.md) - Step-by-step instructions for job seekers.
- 🏗️ [Architecture & Technical Specifications](docs/ARCHITECTURE.md) - C4 diagrams, sequence workflows, and security architecture.
- 🔌 [Internal API & Developer Reference](docs/API_REFERENCE.md) - Message protocols, types, and utility functions.
- 📦 [Chrome Web Store Listing Kit](docs/STORE_LISTING.md) - Store description and reviewer justifications.
- 📜 [Changelog](CHANGELOG.md) - Complete release history.
- 🔒 [Privacy Policy](PRIVACY_POLICY.md) - Privacy declarations and data usage terms.

---

## 📜 License

MIT License. Open source and free for personal and commercial use.
