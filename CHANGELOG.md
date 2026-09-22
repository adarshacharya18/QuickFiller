# Changelog

All notable changes to the **QuickFiller** extension project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.2] - 2026-09-22

### Fixed
- **Firefox LLM Drafting & Port Closure Fix**:
  - **Cross-Browser Sender Verification**: Resolved false message rejections in `background.ts` by recognizing `sender.tab` (content scripts), Firefox Gecko IDs (`browser.runtime.id`), and extension protocol origins (`moz-extension://` and `chrome-extension://`). Prevents premature channel closure errors (`"The message port closed before a response was received."`).
  - **Granular Error Diagnostics**: Updated `generateAnswerForField` in `Drawer.tsx` to surface actual runtime error messages rather than showing generic "Extension context invalidated" alerts.
  - **Dual Context Validation**: Enhanced `isExtensionValid()` in `storage.ts` to inspect both `chrome.runtime.id` and `(globalThis as any).browser?.runtime?.id`.
- **Dual-Layer Ollama Origin Rewriting (Firefox MV2 & Chrome MV3)**:
  - **Native Blocking `webRequest` Engine for Firefox**: Overcame Mozilla's WebExtensions Declarative Net Request limitation where `modifyHeaders` is ignored for extension background requests (due to ungrantable internal initiator host permissions). Implemented `setupOllamaWebRequestRules` in `rules.ts` using native blocking `webRequest` to rewrite `Origin: moz-extension://...` to `http://localhost:11434` and inject `Access-Control-Allow-Origin: moz-extension://...`.
  - **Port-Free Match Patterns**: Defined WebExtension-compliant match patterns (`http://localhost/*`, `http://127.0.0.1/*`) without embedded port numbers (which cause Firefox `Invalid match pattern` errors), filtering target ports (`11434`) dynamically inside listener logic.
  - **Dynamic Manifest Permissions**: Dynamically allocated `webRequest` and `webRequestBlocking` permissions in `wxt.config.ts` specifically for Firefox builds while preserving pure Manifest V3 compliance for Chromium.
  - **DNR Add-on ID Syntax Protection**: Guarded `initiatorDomains` in `setupOllamaDNRRules` against IDs containing `@` characters (such as Gecko add-on IDs), preventing schema syntax validation errors in Firefox's DNR parser.
  - **Universal Rules Orchestration**: Created `setupOllamaRules` to seamlessly synchronize both network rule layers across extension startup, storage preference changes, and inference dispatches.
- **PDF Resume Parser Overhaul & Firefox Compatibility**:
  - **Coordinate-Aware Line Reconstruction**: Reconstructed PDF page lines by tracking vertical position deltas (`deltaY > 3.5`) and `hasEOL` flags, eliminating single-line flattening on 1-page resumes in Firefox Options page (`ProfileTab.tsx`).
  - **Flexible Section Header Matching**: Replaced rigid exact-match lookup with regex-based boundary detection supporting colons, pipes, markdown headers, and variants (`WORK HISTORY`, `EMPLOYMENT HISTORY`, `RELEVANT EXPERIENCE`, `CAREER HISTORY`, `E X P E R I E N C E`).
  - **Comprehensive Experience Date & Role Parsing**: Expanded date range matching to support numeric formats (`MM/YYYY`, `YYYY/MM`), `Month Year`, and modern end dates (`Till Date`, `Ongoing`, `Current`), with intelligent delimiter splitting for company and role (`|`, `-`, `,`, `at`).
  - **Project Link Over-Population Guard**: Restricted `category: 'project'` strictly to genuine code repositories (`github.com/user/repo`, `gitlab`, `bitbucket`), categorizing company websites and articles as `'other'` to eliminate phantom project pollution.
  - **Gecko Worker Resilience**: Added in-thread fake worker fallback to ensure smooth resume parsing even if browser CSP or module worker limits trigger in Firefox.
- **Job Tracker Duplicate Application Prevention**:
  - Implemented submission lock and double-commit prevention in `submissionWatcher.ts`, ensuring exactly one application is logged on rapid clicks or empty form submissions on Workday test forms.
- **Firefox Copilot Drawer Dragging Duplication**:
  - Implemented window-level pointer capture with singleton mount guard, preventing native HTML5 drag ghosting and duplicate window instances in Firefox.

### Tested & Verified
- **Expanded Automated Test Suite**:
  - Added unit test coverage for port-free webRequest origin rewriting, CORS response header injection, Firefox Gecko ID DNR handling, and browser namespace validation.
  - Total test suite expanded to **279 passing tests across 21 test files** with 100% pass rate.
  - Validated with Mozilla's official `addons-linter` (0 errors, 0 notices).

## [1.0.1] - 2026-09-22

### Fixed
- **Firefox Options & Job Tracker Page Opening**:
  - Configured `options_ui.open_in_tab: true` so `chrome.runtime.openOptionsPage()` opens `options.html` directly in a new tab instead of attempting an iframe embed blocked by `frame-ancestors 'none'`.
  - Implemented cross-browser `openTabSafely` in `background.ts` supporting both `browser.*` and `chrome.*` APIs, preventing synchronous `TypeError` crashes during tab queries without the `tabs` permission.
- **Firefox AMO Compatibility**:
  - Added Mozilla built-in data collection consent declarations (`data_collection_permissions: { required: ["none"] }`).
  - Adjusted minimum Gecko version to 140 (Desktop) / 142 (Android) to cleanly align with AMO validation standards.
  - Shortened extension display name to `QuickFiller - App Copilot` to conform with AMO listing constraints.

### Tested & Verified
- **Automated Test Suite**:
  - 253 passing tests across 20 test files.

## [1.0.0] - 2026-09-21

### Added
- **Unified Copilot Drawer & Draggable Window**:
  - Merged standard form fields, custom screening questions, and radio buttons into a single unified tab with dynamic filter pills (`All`, `Questions`, `Standard Inputs`, `Radios`).
  - Implemented draggable floating window with grab handle (`GripHorizontal`), position persistence in `sessionStorage`, and instant reset-to-dock button (`LocateFixed`).
  - Added expandable width toggle for compact (420px) and wide (640px) reading modes.
- **Outreach Message Refiner**:
  - In-drawer AI message enhancer for candidate outreach on LinkedIn, GitHub, and corporate team pages.
  - Generates dual output: LinkedIn Connection Request Notes (enforced ≤ 300 characters) and InMail/email pitches (100–180 words).
  - Target persona selection for **Recruiter** (metrics, availability, core stack) or **Technical Lead** (architecture, deep tech stack, GitHub projects).
  - 1-click direct injection into active LinkedIn message popups and `contenteditable` chat containers.
- **Automated Job Application Tracker**:
  - Automatic submission interception on button click and SPA confirmation page routes.
  - Support for Workday, CRISIL, Darwinbox, Greenhouse, Lever, Google Forms, and Microsoft Forms.
  - Candidate portal URL discovery (e.g. Workday Candidate Home) to monitor ongoing application statuses.
  - Status management dashboard (`Bookmarked`, `Applied`, `Interviewing`, `Offer`, `Rejected`), interview notes, and CSV data export.
- **Deep ATS & Portal Support**:
  - **Workday**: Specialized input handling via `data-automation-id`, separate phone number and phone extension field handling, and JD extraction for cover letters.
  - **CRISIL & Angular SPAs**: Route interception on `/crisil/confirm` and `/jobconfirm`, Angular Material button `data-testid="submit-application-btn"`, SweetAlert container handling, and vendor typo tolerance (`"submited"`, `"sucessfully"`).
  - **Darwinbox**: Floating label and custom dropdown/date picker support.
  - **Google Forms & Microsoft Forms**: Semantic grouping for radio buttons, checkboxes, and containerized question lists.
- **Tailored Cover Letter Generator**:
  - Dynamic scraping of job titles, companies, and requirements from active pages or linked job postings.
  - Tone selection (*Professional*, *Enthusiastic*, *Concise*) and Focus Area selection (*Technical*, *Leadership*, *Culture*).
- **Client-Side PDF Resume Harvester**:
  - Client-side PDF text extraction and embedded hyperlink annotation harvester (portfolio links, GitHub repositories, live demo projects).
- **Dual AI Engine**:
  - 100% offline, zero-cost AI powered by local [Ollama](https://ollama.com/) (`llama3.2`, `qwen2.5`, `mistral`).
  - Bring-Your-Own-Key (BYOK) cloud LLM support for Google Gemini Flash, OpenAI GPT-4o-mini, and Anthropic Claude 3.5 Haiku.
  - Declarative Net Request (DNR) CORS rewriting rules to communicate seamlessly with local Ollama daemons without security leaks.
- **Security & SSRF Protections**:
  - SSRF defense blocking private IPv4, IPv6 loopback, and cloud metadata endpoints on external fetch requests.
  - Sensitive API key masking and token redaction in logs and diagnostic outputs.
  - Shadow DOM isolation preventing host-page style bleeding and script interference.
- **Comprehensive Test Suite**:
  - 18 Vitest test suites with 216 automated tests covering scanner heuristics, autofill event dispatchers, submission watcher, radio resolution, phone utils, security, and external JD resolvers.
- **Cross-Browser Multi-Target Builds**:
  - Manifest V3 build for Chromium browsers (`.output/chrome-mv3`).
  - Manifest V2 build for Mozilla Firefox (`.output/firefox-mv2`).

---

## [0.2.0] - 2026-09-14

### Added
- Pre-Screen Legal Wizard for fast answering of work authorization, sponsorship, notice period, and desired compensation.
- Initial Job Tracker options tab and application state schema.
- Chrome Web Store listing documentation kit and store descriptions.
- Declarative Net Request dynamic rule generator for Ollama CORS handling.

### Fixed
- Resolved React virtual DOM state synchronization bug by invoking prototype-level property descriptors prior to firing synthetic `input`, `change`, and `blur` events.
- Fixed extension context invalidation errors during rapid reloads.

---

## [0.1.0] - 2026-09-12

### Added
- Initial project scaffolding using WXT and React 19.
- Basic DOM scanner for standard text inputs (Name, Email, Phone, URLs).
- Client-side PDF parser with `pdfjs-dist`.
- Floating Copilot Drawer rendered inside an open ShadowRoot.
- Background service worker message router for Ollama and BYOK cloud providers.
- Local mock testing page (`test-form.html`).
