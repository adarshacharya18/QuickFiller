# QuickFiller Internal API & Developer Reference

> Complete technical reference for QuickFiller's internal messaging protocols, data schemas, DOM utilities, and LLM orchestrator.

---

## 1. Background Service Worker Message Protocol

Communication between the injected content scripts (Copilot Drawer), the Options dashboard, the popup, and the background service worker is conducted via `chrome.runtime.sendMessage`.

### Message Types & Payloads

#### `GENERATE_ANSWER`
Invoked by the Copilot Drawer when drafting screening question answers.
- **Request Payload**:
  ```typescript
  {
    type: 'GENERATE_ANSWER';
    questionPrompt: string;
    placeholder?: string;
    isTextarea?: boolean;
    jobContext?: {
      title?: string;
      company?: string;
      location?: string;
      description?: string;
    };
    customInstructions?: string;
    llmSettings?: LLMSettings;
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean;
    answer?: string;
    error?: string;
  }
  ```

---

#### `GENERATE_COVER_LETTER`
Generates a customized, high-converting cover letter matching candidate profile data against extracted job description.
- **Request Payload**:
  ```typescript
  {
    type: 'GENERATE_COVER_LETTER';
    options: {
      jobTitle: string;
      companyName: string;
      jobDescription: string;
      tone?: 'professional' | 'enthusiastic' | 'concise';
      focusArea?: 'general' | 'technical' | 'leadership' | 'culture';
      customNotes?: string;
    };
    llmSettings?: LLMSettings;
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean;
    answer?: string;
    error?: string;
  }
  ```

---

#### `GENERATE_OUTREACH`
Generates refined recruiter outreach messages and LinkedIn connection request notes.
- **Request Payload**:
  ```typescript
  {
    type: 'GENERATE_OUTREACH';
    options: {
      rawDraft: string;
      persona: 'recruiter' | 'technical';
      contextNotes?: string;
      company?: string;
      role?: string;
    };
    llmSettings?: LLMSettings;
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean;
    result?: {
      connectionNote: string;         // ≤ 300 characters
      connectionNoteCharCount: number;
      fullPitch: string;              // 100–180 words
      fullPitchWordCount: number;
      persona: 'recruiter' | 'technical';
    };
    error?: string;
  }
  ```

---

#### `CHECK_OLLAMA`
Performs an active connectivity and model discovery check against a local or remote Ollama server.
- **Request Payload**:
  ```typescript
  {
    type: 'CHECK_OLLAMA';
    host?: string; // Defaults to "http://localhost:11434"
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean;
    models?: Array<{ name: string; size: number; modified_at: string }>;
    error?: string;
  }
  ```

---

#### `FETCH_EXTERNAL_JD`
Fetches and strips clean job description text from external URLs with built-in SSRF protection.
- **Request Payload**:
  ```typescript
  {
    type: 'FETCH_EXTERNAL_JD';
    url: string;
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean;
    title?: string;
    company?: string;
    jdText?: string;
    isValid?: boolean;
    error?: string;
  }
  ```

---

#### `OPEN_JOB_TRACKER` / `OPEN_OPTIONS_PAGE`
Navigates the user to a specific tab inside the full-page Options Dashboard.
- **Request Payload**:
  ```typescript
  {
    type: 'OPEN_JOB_TRACKER' | 'OPEN_OPTIONS_PAGE';
    tab?: 'profile' | 'questions' | 'applications' | 'settings';
  }
  ```
- **Response**:
  ```typescript
  { success: boolean }
  ```

---

#### `TOGGLE_DRAWER` / `INJECT_AND_OPEN_DRAWER`
Controls the visibility of the Copilot Drawer on the active browser tab.
- **Request Payload**:
  ```typescript
  {
    type: 'INJECT_AND_OPEN_DRAWER' | 'INJECT_AND_TOGGLE_DRAWER';
    tabId?: number;
  }
  ```
- **Response**:
  ```typescript
  { success: boolean; injected?: boolean; error?: string }
  ```

---

## 2. Storage Schema & Contracts ([`src/types/storage.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/types/storage.ts))

All extension state is stored in `chrome.storage.local` under a single strongly-typed root object:

```typescript
export interface StorageData {
  profile: CandidateProfile;
  wizardAnswers: ScreeningWizardAnswers;
  questionBank: ScreeningQuestion[];
  customPasteBank: CustomPasteItem[];
  llmSettings: LLMSettings;
  applications: JobApplication[];
  jobTrackerEnabled: boolean;
  autoTrackOnSubmit: boolean;
  extensionEnabled: boolean;
}
```

### Data Models

#### `CandidateProfile` ([`src/types/profile.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/types/profile.ts))
Contains parsed resume and candidate biographical data:
- `personal`: First & last name, email, primary phone, phone extension, city, state, postal code, country, LinkedIn, GitHub, portfolio URLs.
- `summary`: High-level professional summary.
- `skills`: Categorized technical competencies.
- `experience`: Array of past roles, companies, dates, and bulleted achievements.
- `education`: Institutions, degrees, graduation years, GPAs.
- `projects`: Title, role, technologies, descriptions, demo/repo links.
- `extractedLinks`: Hyperlink annotations harvested from PDF resumes.

#### `ScreeningWizardAnswers` ([`src/types/questions.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/types/questions.ts))
Standardized answers for high-frequency legal & compliance questionnaire filters:
- `authorizedToWork`: `"Yes"` | `"No"`
- `requireSponsorship`: `"No"` | `"Yes"`
- `noticePeriod`: e.g. `"Immediate"`, `"2 weeks"`, `"30 days"`
- `desiredSalary`: e.g. `"$130,000 - $160,000 USD"`
- `openToRelocation`: `"Yes"` | `"Remote Only"` | `"No"`
- `gender`, `veteranStatus`, `disabilityStatus`: Optional EEO disclosures.

#### `JobApplication` ([`src/types/applications.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/types/applications.ts))
Records tracked job submissions:
- `id`: Unique timestamped identifier (`app_<timestamp>_<rand>`).
- `company`: Employer name (e.g. `"CRISIL"`, `"Workday"`, `"Google"`).
- `title`: Extracted job title (e.g. `"Associate Engineer - Gen AI"`).
- `url`: Direct link to the posting or application portal.
- `portalUrl`: Candidate tracking portal URL (e.g. Workday Candidate Home).
- `appliedDate`: ISO 8601 timestamp string.
- `status`: `'Bookmarked' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected'`
- `location`, `salary`, `notes`: User notes and extracted details.

---

## 3. Core Utility Modules

### A. DOM Scanner ([`src/utils/scanner.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/scanner.ts))

| Function | Signature | Description |
| :--- | :--- | :--- |
| `scanFormFields` | `(container?: HTMLElement \| Document): { standardFields: DetectedField[]; customQuestions: DetectedField[] }` | Traverses the DOM to identify form inputs, categorizes standard profile fields, and extracts custom screening questions. |
| `extractJobMetadata` | `(): JobMetadata` | Scrapes document title, meta tags, and high-priority DOM selectors (`[class*="align-titleJob"]`, `[class*="jobVwHeading"]`) to extract job title, employer company, and location. Correctly handles corporate subdomains (`career.crisil.com` $\rightarrow$ `CRISIL`). |
| `getCleanFormatHint` | `(field: DetectedField): string \| undefined` | Cleans up placeholders to guide the candidate or AI model on expected format. |
| `isInsideQuickFillerDrawer` | `(el: Element): boolean` | Checks if a DOM element belongs to the QuickFiller Shadow DOM to avoid self-scanning. |

---

### B. Synthetic Autofill Dispatcher ([`src/utils/autofill.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/autofill.ts))

| Function | Signature | Description |
| :--- | :--- | :--- |
| `setNativeInputValue` | `(element: HTMLInputElement \| HTMLTextAreaElement, value: string): void` | Sets value via prototype property descriptor and fires `input`, `change`, and `blur` events so React, Angular, and Vue state synchronizes properly. |
| `setNativeRadioChecked` | `(element: HTMLInputElement, checked: boolean): void` | Programmatically selects radio buttons or checkboxes while dispatching native synthetic click and change sequences. |
| `insertTextAtCursor` | `(element: HTMLElement, text: string): boolean` | Injects text at active caret position in standard inputs, `<textarea>`, and `contenteditable` elements (e.g. LinkedIn message editor). |
| `resolveStandardFieldValue`| `(fieldType: StandardFieldType, profile: CandidateProfile): string` | Maps detected field categories to candidate profile values. |

---

### C. Submission & Portal Watcher ([`src/utils/submissionWatcher.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/submissionWatcher.ts))

| Function / Constant | Signature / Type | Description |
| :--- | :--- | :--- |
| `initSubmissionWatcher` | `(onSubmission: (app: JobApplication) => void): () => void` | Initializes click listeners on submit buttons, navigation observers, and DOM mutation observers. Returns teardown function. |
| `isSubmitTriggerElement`| `(el: HTMLElement): boolean` | Returns `true` if an element is a submit button by inspecting tag name, `type="submit"`, text content, `data-testid`, `data-automation-id`, and `data-qa`. |
| `hasVisibleSuccessMessage`| `(root?: Document \| HTMLElement): boolean` | Scans the DOM for confirmation keywords, Angular confirmation components (`<app-jobconfirm>`, `<lib-apply-confirmation>`), Greenhouse tracking widgets, and SweetAlert containers. |
| `isGenericConfirmationTitle` | `(title?: string \| null): boolean` | Returns `true` if document title is a generic confirmation message (e.g. `"Thank you for applying"`, `"Application submitted"`) rather than a real job role. |
| `findJobPostingLinkOnConfirmation` | `(root?: Document \| Element): string \| null` | Inspects confirmation DOM for links pointing back to original job post (e.g. `"Back to job post"`, `/jobs/<id>`). |
| `extractApplicationPortalUrl` | `(root?: Document \| Element): string \| null` | Scans confirmation DOM for candidate portal links (Workday `candidateHome`, Greenhouse `my.greenhouse.io`, SmartRecruiters `my.smartrecruiters.com`, Darwinbox). |
| `CONFIRMATION_URL_REGEX`| `RegExp` | Matches confirmation URLs: `/submitted`, `/confirmation`, `/confirm`, `/jobconfirm`, `/thank-you`. |
| `SUCCESS_TEXT_REGEX` | `RegExp` | Matches success messages, including standalone `"Thank You"`, `"profile ... submitted"`, and vendor typos (`"submited"`, `"sucessfully"`). |

---

### D. Security & SSRF Utilities ([`src/utils/security.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/security.ts))

| Function | Signature | Description |
| :--- | :--- | :--- |
| `isSafeExternalUrl` | `(rawUrl: string): { safe: boolean; error?: string; url?: URL }` | Validates URLs before fetching in the background worker. Blocks private IPv4/IPv6, cloud metadata endpoints, and localhost loopbacks. |
| `redactSecrets` | `(text: string, secrets?: (string \| undefined)[]): string` | Replaces Bearer tokens, query parameter API keys (`?key=...`), and configured credentials with `[REDACTED]`. |
| `isSafeWebUrl` | `(url: string): boolean` | Validates web links for safe rendering in UI anchors. |
| `sanitizeWebUrl` | `(url: string): string` | Prepends `https://` if protocol is missing and strips dangerous schemes (`javascript:`, `data:`). |

---

### E. LLM Engine ([`src/utils/llm/`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/llm/))

| File / Function | Description |
| :--- | :--- |
| [`generateAnswer`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/llm/index.ts) | Dispatches prompts to the active provider (Ollama, Gemini, OpenAI, Anthropic) based on user configuration. |
| [`buildSystemPrompt`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/llm/prompt.ts) | Compiles CandidateProfile, WizardAnswers, QuestionBank, and CustomPasteBank into an expert system prompt for screening questions. |
| [`cleanAnswerOutput`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/llm/prompt.ts) | Sanitizes LLM-drafted screening answers: removes XML tags (`<screening_answer>`, `<answer>`), markdown fences, preambles, outros, and enclosing quotes. |
| [`buildCoverLetterSystemPrompt`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/llm/coverLetterPrompt.ts) | Formulates a professional cover letter writing persona incorporating past projects and experience. |
| [`cleanCoverLetterOutput`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/llm/coverLetterPrompt.ts) | Strips markdown code blocks, conversational greetings, and closing offers from drafted cover letters. |
| [`buildOutreachSystemPrompt`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/llm/outreachPrompt.ts) | Configures tone and formatting rules for recruiter or technical outreach pitches. |

---

### F. PDF Resume Parser & Link Extractor ([`src/utils/pdfParser.ts`](file:///home/adarsh/Documents/Projects/QuickFiller/src/utils/pdfParser.ts))

| Function / Type | Signature | Description |
| :--- | :--- | :--- |
| `parseResumePdf` | `(fileBuffer: ArrayBuffer): Promise<ParsedResumeResult>` | End-to-end PDF resume parser. Extracts text with coordinates, embedded annotations, contact info, sections, experience, projects, education, and skills. Automatically falls back to in-thread parsing if Gecko worker fails. |
| `reconstructTextWithLines` | `(items: any[]): string` | Reconstructs visual line breaks from PDF text items by tracking vertical coordinate deltas (`deltaY > 3.5`) and `hasEOL` flags, preserving horizontal whitespace gaps (`gap > 2`). |
| `matchSectionHeader` | `(line: string): string \| null` | Robust section header detector. Strips bullets, colons, pipes, and markdown formatting, matching synonyms for `experience`, `projects`, `education`, `skills`, `certificates`, and `summary`. |
| `parseResumeSections` | `(text: string): Record<string, string[]>` | Segments continuous text into categorized arrays of line items. |
| `parseExperience` | `(lines: string[]): ExperienceItem[]` | Extracts work experiences using broad date patterns (`MM/YYYY`, `YYYY/MM`, `Month Year`, `Till Date`, `Ongoing`, `Current`), extracts locations, and splits roles and companies cleanly. |
| `parseProjects` | `(lines: string[], links: ExtractedLink[]): ProjectItem[]` | Extracts projects, descriptions, and technologies. Matches project titles to discovered GitHub repo links while ignoring general web URLs. |
| `parseSkills` | `(lines: string[]): string[]` | Parses comma/bullet-separated skills, removing category prefixes and deduplicating tokens. |
| `parseEducation` | `(lines: string[]): EducationItem[]` | Extracts institution, degree, field of study, graduation year, and GPA. |
| `extractCandidateName` | `(fullText: string, email?: string, phone?: string): { firstName: string; lastName: string }` | Discovers candidate name preceding contact information block. |
| `extractCity` | `(headerLines: string[], email: string, phone: string): string` | Extracts city from header lines using City, State regex patterns or international city dictionaries. |
| `classifyResumeUrl` | `(rawUrl: string): { category: string; isProfile: boolean; username?: string }` | Classifies links into `github`, `linkedin`, `portfolio`, `project` (code repositories), or `other`. |

