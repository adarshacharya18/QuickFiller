# QuickFiller Architecture & Technical Specifications

> **A 100% Local-First, Privacy-Obsessed Job Application Copilot and Autofill Extension**  
> Supports Chromium (Manifest V3) & Firefox (Manifest V2).

---

## 1. System Overview & Architectural Tenets

QuickFiller is an intelligent browser extension engineered to eliminate the manual friction of job applications while guaranteeing absolute data sovereignty.

### Core Principles
1. **100% Local-First Storage**: All candidate profiles, PDF parsed resumes, confidential screening answers, custom paste items, and tracked job applications reside exclusively in the user's browser sandbox via [`chrome.storage.local`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/storage.ts). No analytics, no tracking beacons, no developer-hosted backend databases.
2. **Dual AI Pipeline (Local & BYOK Cloud)**: Zero-cost offline generation through local [Ollama](https://ollama.com/) instances (`llama3.2`, `mistral`, `qwen2.5`) with Declarative Net Request (DNR) CORS rewriting, alongside Bring-Your-Own-Key (BYOK) cloud LLMs (Google Gemini Flash, OpenAI GPT-4o-mini, Anthropic Claude 3.5 Haiku).
3. **Resilient ATS & Form Engine**: Native adapters for enterprise Applicant Tracking Systems (Workday, Darwinbox, CRISIL, SmartRecruiters, Greenhouse, Lever, Google Forms, Microsoft Forms). Bypasses React, Angular, and Vue virtual DOM state trapping through prototype-level synthetic event dispatching.
4. **Isolated Presentation Layer**: Floating Copilot Drawer rendered inside a shadow root (`attachShadow({ mode: 'open' })`) with encapsulated CSS, guaranteeing zero styling conflicts or JavaScript pollution on host pages.

---

## 2. High-Level Architecture (C4 Diagrams)

### Context Diagram (System Level)

```mermaid
flowchart TD
    User([Job Candidate])

    subgraph Browser["Candidate Browser (Chromium / Firefox)"]
        QF["QuickFiller Extension\n(MV3 Service Worker + Content Script + Options Dashboard)"]
        LocalStorage[("chrome.storage.local\n(Encrypted Sandbox)")]
    end

    subgraph LocalSystem["Local Workstation"]
        OllamaEngine["Local Ollama Daemon\n(http://localhost:11434)"]
    end

    subgraph CloudProviders["Cloud LLM Providers (BYOK)"]
        GeminiAPI["Google Gemini API\n(generativelanguage.googleapis.com)"]
        OpenAIAPI["OpenAI API\n(api.openai.com)"]
        AnthropicAPI["Anthropic API\n(api.anthropic.com)"]
    end

    subgraph ATSPlatforms["Employer & ATS Platforms"]
        Workday["Workday Candidate Home\n(*.myworkdayjobs.com)"]
        Greenhouse["Greenhouse / Lever\n(boards.greenhouse.io / jobs.lever.co)"]
        Darwinbox["Darwinbox Candidate Portal\n(*.darwinbox.in)"]
        Crisil["CRISIL Portal / Angular SPAs\n(career.crisil.com)"]
        WebForms["Google Forms & Microsoft Forms\n(docs.google.com/forms / forms.office.com)"]
        LinkedIn["LinkedIn Messaging & Recruiter\n(linkedin.com)"]
    end

    User -->|"Interacts with Copilot Drawer / Options UI"| QF
    QF <-->|"Reads/Writes Profile, Q&A, Tracking Data"| LocalStorage
    QF -->|"Local Model Inference (Rewritten Origin Header)"| OllamaEngine
    QF -->|"Optional BYOK Cloud Generation"| CloudProviders
    QF -->|"Scans DOM, Injects Answers, Dispatches Native Events"| ATSPlatforms
    ATSPlatforms -->|"Submissions Monitored via SPAs & HTTP routes"| QF
```

---

### Container Diagram (Extension Components)

```mermaid
flowchart TB
    subgraph Extension["QuickFiller Extension Bundle"]
        subgraph BackgroundSW["Background Service Worker (background.ts)"]
            MsgBus["Runtime Message Router"]
            DNRManager["DNR Rule Engine (rules.ts)"]
            LLMOrchestrator["LLM Orchestrator (llm/index.ts)"]
            SSRFValidator["SSRF & Security Shield (security.ts)"]
            JDFetcher["External JD Resolver (jdResolver.ts)"]
        end

        subgraph ContentScript["Injected Content Script (content/index.tsx)"]
            ShadowMount["Shadow DOM Container (#quickfiller-copilot-root)"]
            
            subgraph CopilotDrawer["Interactive Copilot Drawer (Drawer.tsx)"]
                DraggableWindow["Draggable & Resizable Window Manager"]
                AutofillView["Unified Autofill & AI Questions View"]
                CoverLetterView["Tailored Cover Letter Generator"]
                OutreachView["Outreach Message Refiner"]
                PasteBankView["Quick Paste Snippet Bank"]
            end

            DOMScanner["DOM Scanner & Heuristic Engine (scanner.ts)"]
            AutofillDispatcher["Synthetic Event Dispatcher (autofill.ts)"]
            RadioResolver["Radio & Checkbox Resolver (radioResolver.ts)"]
            SubWatcher["Submission & Portal Watcher (submissionWatcher.ts)"]
        end

        subgraph OptionsUI["Options Dashboard (options/App.tsx)"]
            ProfileTab["Profile & PDF Resume Harvester (ProfileTab.tsx)"]
            QuestionsTab["Pre-Screen Legal Wizard & Q&A Bank (QuestionsTab.tsx)"]
            AppTrackerTab["Application Tracker & CSV Export (ApplicationsTab.tsx)"]
            SettingsTab["LLM Manager & Model Health Checks (SettingsTab.tsx)"]
        end

        subgraph PopupUI["Action Popup (popup/App.tsx)"]
            StatusCard["Quick Status & Launch Controls"]
        end
    end

    CopilotDrawer --> DOMScanner
    CopilotDrawer --> AutofillDispatcher
    CopilotDrawer --> RadioResolver
    ContentScript --> SubWatcher
    ContentScript <-->|"chrome.runtime.sendMessage"| MsgBus
    OptionsUI <-->|"chrome.storage.local"| BackgroundSW
    PopupUI <-->|"chrome.tabs.sendMessage"| ContentScript
```

---

## 3. Data Flow & Sequence Workflows

### 1. Unified Autofill & Question Generation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    participant Drawer as Copilot Drawer (Shadow DOM)
    participant Scanner as DOM Scanner (scanner.ts)
    participant Autofill as Event Dispatcher (autofill.ts)
    participant BG as Service Worker (background.ts)
    participant Storage as chrome.storage.local
    participant LLM as Ollama / Cloud LLM

    Candidate->>Drawer: Clicks "Fill All Standard" or "Draft Answer"
    Drawer->>Storage: Retrieve candidate profile & question bank
    Storage-->>Drawer: Profile data & screening answers
    
    alt Standard Inputs (Name, Email, Phone, URLs)
        Drawer->>Autofill: setNativeInputValue(input, profileValue)
        Autofill->>Autofill: Prototype descriptor setter + input/change/blur events
        Autofill-->>Drawer: Field successfully updated in React/Angular state
    else Custom Screening Question
        Drawer->>BG: chrome.runtime.sendMessage({ type: 'GENERATE_ANSWER', ... })
        BG->>Storage: Read active LLM settings & system prompt context
        Storage-->>BG: LLMSettings & CandidateProfile
        BG->>LLM: Streamed or synchronous completion prompt
        LLM-->>BG: Tailored, high-impact answer
        BG-->>Drawer: { success: true, answer }
        Candidate->>Drawer: Clicks "Insert"
        Drawer->>Autofill: insertTextAtCursor(targetElement, answer)
        Autofill-->>Candidate: Answer injected into active form field
    end
```

---

### 2. Automatic Application Submission Interception

```mermaid
sequenceDiagram
    autonumber
    participant DOM as Employer Career Portal (e.g. Workday / CRISIL)
    participant Watcher as Submission Watcher (submissionWatcher.ts)
    participant Scanner as Metadata Scanner (scanner.ts)
    participant Storage as chrome.storage.local
    actor Candidate as Candidate

    Candidate->>DOM: Clicks Submit Application Button
    Watcher->>Watcher: Intercepts click on data-testid / data-automation-id
    Watcher->>Scanner: extractJobMetadata() (Company, Title, Location)
    Watcher->>Watcher: Records pendingSubmission timestamp & metadata
    
    alt Single Page Application (SPA Route Change)
        DOM->>DOM: Router navigates to /confirm or /jobconfirm
        Watcher->>Watcher: History pushState / popstate / hashchange listener fires
    else DOM Confirmation Mutation
        DOM->>DOM: Mounts <app-jobconfirm> / "Thank You" banner
        Watcher->>Watcher: MutationObserver detects SUCCESS_TEXT_REGEX
    end

    Watcher->>Watcher: Extracts candidate portal tracking URL
    Watcher->>Storage: Appends JobApplication to storage.applications
    Storage-->>Watcher: Persistence confirmed
    Watcher-->>Candidate: Emits success event & updates Job Tracker
```

---

## 4. Key Component Deep Dives

### A. DOM Scanner & Heuristic Engine ([`src/utils/scanner.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/scanner.ts))
- **Standard Field Detection**: Evaluates attributes (`name`, `id`, `autocomplete`, `placeholder`, `aria-label`, `data-automation-id`) using weighted regex scoring to categorize fields into:
  - First Name, Last Name, Full Name
  - Email Address
  - Phone Number & Phone Extension (specialized regex separating country code, primary number, and extension fields)
  - Address, City, State, Postal Code, Country
  - LinkedIn, GitHub, Portfolio URLs
- **Screening Question Extractor**: Identifies multiline `<textarea>` and custom text fields accompanied by `<label>`, `aria-labelledby`, or preceding heading text. Filters out search bars, promo codes, and standard login fields.
- **ATS Platform Detection**:
  - **Workday**: Detects Workday custom attributes (`data-automation-id="formField-..."`, `data-automation-id="legalNameSection_firstName"`).
  - **Darwinbox**: Resolves Darwinbox custom form fields and floating labels.
  - **CRISIL / Angular SPAs**: Extracts headings (`[class*="align-titleJob"]`, `[class*="jobVwHeading"]`) and handles corporate subdomains (`career.crisil.com` $\rightarrow$ `CRISIL`).
  - **Google Forms & Microsoft Forms**: Scans form group containers (`div[role="listitem"]`, `div[data-automation-id="questionItem"]`) to bind questions with corresponding inputs.

### B. Synthetic Autofill Dispatcher ([`src/utils/autofill.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/autofill.ts))
Modern frontend frameworks (React, Angular, Vue) override native DOM property setters (`input.value = '...'`) with internal virtual DOM state trackers. Simply setting `.value` results in values being erased on blur.
QuickFiller overcomes this by:
1. Accessing the underlying native prototype descriptor:
   ```typescript
   const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
     window.HTMLInputElement.prototype,
     'value'
   )?.set;
   nativeInputValueSetter?.call(element, value);
   ```
2. Dispatching a synchronized sequence of synthetic events:
   - `focus` $\rightarrow$ `keydown` $\rightarrow$ `input` (with `{ bubbles: true, composed: true }`) $\rightarrow$ `keyup` $\rightarrow$ `change` $\rightarrow$ `blur`.
3. Multi-frame & ContentEditable Support: Injects text at active caret locations in `contenteditable` elements (e.g. LinkedIn message editors, Rich Text editors).

### C. Radio & Checkbox Engine ([`src/utils/radioResolver.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/radioResolver.ts))
Handles complex binary and categorical screening queries (Work Authorization, Visa Sponsorship, Relocation, Gender, Veteran Status):
- Extracts radio groups grouped by `name` or ARIA `role="radiogroup"`.
- Matches options using semantic normalization (`yes`, `no`, `authorized`, `sponsorship required`, `immediate`, `negotiable`).
- Dispatches native click and checked property updates without triggering form validation errors.

### D. Outreach Message Refiner ([`src/entrypoints/content/Drawer.tsx`](file:///home/adarsh/Documents/Projects/QuickFiller/src/entrypoints/content/Drawer.tsx))
Built specifically for candidate outreach on LinkedIn and non-job pages:
- **Dual Output Generation**:
  1. **Connection Request Note**: Strict length enforcement (≤ 300 characters) designed for LinkedIn's connection request limit.
  2. **InMail / Full Pitch**: Structured 100–180 word introductory message highlighting relevant skills, projects, and custom context notes.
- **Persona Adaptation**:
  - `recruiter`: Emphasizes role fit, years of experience, immediate availability, and core tech stack.
  - `technical`: Emphasizes architectural paradigms, engineering methodologies, specific GitHub projects, and open-source contributions.

---

## 5. Security Architecture & Threat Modeling

QuickFiller follows defense-in-depth principles:

### 1. SSRF & Loopback Protection ([`src/utils/security.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/security.ts))
When resolving external job descriptions (`FETCH_EXTERNAL_JD`), the background service worker strictly filters URLs through [`isSafeExternalUrl`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/security.ts#L13-L74):
- Blocks private IPv4 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`).
- Blocks private IPv6 ranges (`::1`, `fc00:`, `fd00:`, `fe80:`).
- Disallows loopback domains (`localhost`, `*.localhost`, `*.internal`, `*.local`).
- Enforces strict 10-second request timeouts and a 2.5 MB HTML parsing ceiling.

### 2. Declarative Net Request (DNR) CORS Shield ([`src/utils/rules.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/rules.ts))
Local Ollama instances reject cross-origin requests by default. Rather than exposing Ollama to all external websites:
- QuickFiller uses Chrome's `declarativeNetRequest` to rewrite the `Origin` request header exclusively for requests originating from the extension (`chrome-extension://<id>`).
- Re-sets `Access-Control-Allow-Origin` to the extension origin only, preventing malicious web pages on the user's browser from communicating with the local Ollama daemon.

### 3. Secret Redaction & Sanitization
All API keys (Gemini, OpenAI, Anthropic) are masked and stripped from logs, error payloads, and diagnostic outputs using [`redactSecrets`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/security.ts#L79-L98).

---

## 6. Client-Side PDF Resume & Link Harvester Pipeline

The PDF resume parser ([`src/utils/pdfParser.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/pdfParser.ts)) enables client-side biographical extraction without sending files to third-party OCR services:

```mermaid
flowchart TD
    PDF[Raw Resume PDF File] --> Buffer[ArrayBuffer]
    Buffer --> SecValidation["Security Validation\n(Header & Size Check)"]
    SecValidation --> PDFJS["PDF.js Engine\n(Web Worker / In-Thread Fallback)"]
    
    subgraph Extraction["Page Extraction Layer"]
        PDFJS --> TextContent["getTextContent() Items\n[str, transform(x,y), hasEOL]"]
        PDFJS --> Annotations["getAnnotations()\nEmbedded Links /Annots"]
    end

    TextContent --> LineRecon["Coordinate-Aware Line Reconstructor\n(reconstructTextWithLines)"]
    LineRecon --> FullText["Formatted Multiline Text"]
    
    FullText --> SectionParser["Section Segmentation\n(matchSectionHeader)"]
    SectionParser --> ExpBlock["Experience Lines"]
    SectionParser --> ProjBlock["Project Lines"]
    SectionParser --> SkillBlock["Skill Lines"]
    SectionParser --> EduBlock["Education Lines"]

    ExpBlock --> ExpParser["Experience Parser\n(Broad Date Regex + Role/Company Separators)"]
    ProjBlock --> ProjParser["Project Parser\n(Tech Stack Detection + Repo Link Matching)"]
    Annotations --> LinkClassifier["Link Classifier\n(classifyResumeUrl)"]
    LinkClassifier --> ProjParser

    ExpParser --> CandidateProfile[Candidate Profile State]
    ProjParser --> CandidateProfile
    SkillBlock --> CandidateProfile
    EduBlock --> CandidateProfile
```

### Architectural Highlights
1. **Coordinate-Aware Line Reconstruction**: PDF content streams do not encode newlines. The parser tracks vertical coordinate deltas (`deltaY > 3.5`) and `hasEOL` flags to accurately reconstruct visual lines and horizontal gaps.
2. **Flexible Section Segmentation**: Supports diverse typographical layouts (colons, markdown, pipes, spaced letters like `E X P E R I E N C E`, and synonyms like `WORK HISTORY` or `EMPLOYMENT HISTORY`).
3. **Broad Date & Role Engine**: Handles `MM/YYYY`, `YYYY/MM`, `Month Year`, and end dates (`Till Date`, `Ongoing`, `Current`) alongside delimiter splitting (`|`, `-`, `,`, `at`).
4. **Resilient Worker Architecture**: Resolves worker URLs via `browser.runtime.getURL` and automatically falls back to in-thread parsing if Gecko MV2 CSP limits trigger in Firefox.

