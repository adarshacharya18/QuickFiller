# QuickFiller: Local-First Smart Job Application Copilot

## Problem Statement
How might we eliminate the repetitive friction of job applications with a private, open-source browser extension that reliably autofills standard details and contextually drafts screening answers without breaking on complex ATS platforms?

---

## Recommended Direction: The Smart Copilot Drawer (Direction B)

Build **QuickFiller** as a local-first, open-source Chromium extension (Manifest V3) combining **silent heuristic autofill** for predictable inputs with an **in-page slide-out copilot drawer** for complex and custom screening questions.

Instead of fighting an endless battle against fragile ATS DOMs (like Workday iframes and synthetic shadow roots), QuickFiller fills what it reliably can, and loads the remaining questions into an interactive slide-out panel with pre-drafted answers, one-click field insertion, and instant clipboard fallback.

### Key Architectural Pillars:
1. **100% Local-First & Zero Running Cost:** Your personal data, resume, and past answers never touch a central server. Everything resides in `chrome.storage.local`.
2. **Dual-Mode LLM Engine:** Choose between a local, private LLM via **Ollama** (`http://localhost:11434`) or bring-your-own cloud API key (Google Gemini, OpenAI, Claude).
3. **Structured Context, Not Vector RAG:** A candidate's entire master profile is ~3,000–5,000 tokens. The entire profile fits directly into modern LLM context windows, guaranteeing complete career context without the memory bloat, latency, or retrieval failures of vector databases.
4. **Bootstrapped Onboarding with Deep Link Extraction:** Upload a resume (PDF/DOCX) → client-side parse visible text and embedded PDF hyperlink annotations (especially portfolio, GitHub, and live project links) → guided setup for high-frequency screening questions (work authorization, visa, notice period, compensation expectations).

---

## Key Assumptions to Validate

- [ ] **PDF Link & Annotation Extraction:** Client-side PDF.js can accurately parse both text and embedded PDF link annotations (`pdfPage.getAnnotations()`) to uncover portfolio, GitHub, and project links. *(Validation test: run extraction on 3 resume PDFs with embedded hyperlinks).*
- [ ] **Ollama Localhost Connectivity:** Chrome Extension background service workers can reach `http://localhost:11434` without CORS blockers or permissions failures. *(Validation test: send a test request to Ollama from a sample MV3 extension script).*
- [ ] **Synthetic Event Dispatch:** Triggering standard React/Angular input events (`input`, `change`, `blur`) on Greenhouse and Lever forms reliably updates internal form state on submission. *(Validation test: inject values into sample live Greenhouse and Lever forms).*
- [ ] **Shadow DOM Drawer Isolation:** The Copilot Drawer can be injected via Shadow DOM or an isolated iframe so that target website CSS does not corrupt the extension UI. *(Validation test: render drawer on 3 visually distinct job boards).*

---

## MVP Scope

### What's In (v1):
- **Core Extension (Manifest V3):** Options page (profile management), background service worker (API/Ollama router), and content script (DOM scanner & Copilot Drawer).
- **Settings & LLM Router:** Configuration tab supporting Ollama (`model: llama3.2 / mistral / qwen2.5`) and Cloud APIs (Gemini Flash, OpenAI, Anthropic).
- **Resume Onboarding & Link Enrichment Flow:** 
  - Drag-and-drop resume PDF upload parsed via client-side PDF.js.
  - **Embedded Link Harvester:** Extracts visible text as well as embedded URI annotations (Portfolio, GitHub, LinkedIn, project links).
  - **Portfolio Context:** Stores portfolio URL and allows quick project note additions so the LLM can reference specific portfolio achievements.
  - Review & edit structured JSON (Contact, Experience, Education, Skills, Links).
  - Common Screening Questions Wizard: Prompts the user to pre-answer standard screening questions (Work Auth, Visa Sponsorship, Notice Period, Desired Salary, Diversity declarations).
- **Auto-Scanner & Heuristic Filler:** Automatically detects and fills common standard inputs (First Name, Last Name, Email, Phone, LinkedIn, GitHub, Portfolio).
- **In-Page Copilot Drawer:**
  - Auto-extracts Job Title and Job Description from the active tab.
  - Lists detected custom screening questions.
  - Generates tailored drafts using your selected LLM + candidate profile + portfolio details.
  - **"Insert"** and **"Copy"** buttons for every field.
  - Quick-refine buttons (*"Make it concise"*, *"Highlight portfolio project"*).

### What's Out (Post-MVP):
- Automated auto-submit bot (user must always review and submit manually for safety).
- Remote user accounts, cloud syncing, or subscriptions.
- Complex vector RAG pipelines or local embedding models.
- Support for non-Chromium browsers (Firefox/Safari) during initial rollout.

---

## Not Doing (and Why)

- **No Remote Backend Server:** Keeping the app 100% client-side guarantees complete candidate privacy, zero operating cost, and pure open-source self-sufficiency.
- **No Heavy Vector RAG:** Storing full structured JSON and passing relevant profile sections directly in prompts eliminates 50MB+ bundle bloat and chunking retrieval errors.
- **No Headless Auto-Apply / Mass Bot Submissions:** Auto-submit tools frequently hallucinate wrong answers, trigger ATS bot detection, and get candidate profiles blacklisted. QuickFiller speeds up human application; it does not spam.
- **No Flaky Workday DOM Reverse-Engineering in v1:** Rather than spending weeks trying to automate Workday's proprietary iframes, the Copilot Drawer gives you instant 1-click paste cards that work across 100% of sites.

---

## Open Questions
1. **Default Model Recommendation:** For Ollama users on laptops, should we recommend `llama3.2:3b` as the default fast lightweight model?
2. **UI Framework for the Drawer:** Lightweight Preact / vanilla Web Components to keep the extension footprint under 1MB?
3. **Repository Structure:** Monorepo with Vite + TypeScript + WXT (Web Extension Framework) or CRXJS?
