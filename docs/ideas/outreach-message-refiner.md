# QuickFiller Outreach & Message Refiner ("Outreach Studio")

## Problem Statement
How might we enable job seekers and developers to instantly refine raw, informal notes into high-impact, professional outreach messages (for recruiters or technical leads) directly within their browser workflow, leveraging QuickFiller’s private local/cloud LLMs and saved career context?

## Recommended Direction: Outreach Studio Tab in Copilot Drawer

Implement a dedicated **Outreach** tab inside the QuickFiller Copilot Drawer that auto-activates when no form fields are detected on the current page (e.g. LinkedIn profiles, recruiter inboxes, Gmail, GitHub), while remaining accessible anytime on ATS job application pages.

### Key Features:
1. **Target Persona Switcher:**
   - **Recruiter / HR Mode:** Focuses on core competencies, years of experience, relevant domain match, availability, and clear call-to-action.
   - **Technical Lead / Peer Mode:** Focuses on architecture, tech stack resonance, shared open-source/technical interests, and high-signal engineering conversation (skipping HR corporate fluff).
2. **Dual-Variant Output with Live Character Counts:**
   - **Variant A (Short Hook / Connection Note):** Strictly under 300 characters for LinkedIn connection requests.
   - **Variant B (Value Pitch / InMail & Email):** 2–3 punchy paragraphs with a bulleted value proposition and a low-friction ask.
3. **Context Injection:**
   - **Manual Context Box:** Optional notes (e.g. *"Spoke at ReactConf"*, *"Applied for Staff Backend role"*).
   - **1-Click "Use Current Page Context":** If browsing a job posting, LinkedIn profile, or company site, extracts the company name and title into the prompt.
   - **Candidate Profile Fusion:** Pulls candidate name, current role, top 3 skills, and portfolio URL from QuickFiller's local storage.
4. **Action Triggers:**
   - **1-Click Copy** to clipboard for each variant.
   - **Insert at Cursor** into the active message input on the page if focused.

## Key Assumptions to Validate
- [ ] **Prompt Anti-Cliché Adherence:** Local models (Llama 3.2 3B) and cloud APIs (Gemini/Claude) reliably follow negative constraints (banning *"delighted to connect"*, *"synergy"*, etc.) without degrading message tone.
- [ ] **Character Budget Enforcement:** Prompt length limits consistently hold Variant A under 300 characters across all configured LLM providers.
- [ ] **Cursor Insertion in Web Messaging:** Test `insertTextAtCursor()` across LinkedIn messaging, Gmail compose, and standard contenteditable textareas.

## MVP Scope

### What's In:
- **New Tab in Drawer:** `Outreach` tab (with icon `Send` / `MessageSquareShare`) alongside Autofill, Questions, Cover Letter, and Bank.
- **Smart Default Tab Logic:** When `totalFields === 0`, Drawer defaults to `Outreach` instead of an empty `Autofill` state.
- **UI Components:**
  - Raw Draft textarea (placeholder: *"e.g., hey saw your team is building with rust, want to know if you're hiring for backend..."*).
  - Target Persona segmented control (`Recruiter` | `Engineering Lead`).
  - Optional Context textarea (`Target Company / Role / Custom Hook`).
  - 1-Click "Inject Page / Profile Context" button.
  - "Refine Message" button with loading indicator.
  - Output cards for **Variant A (Connection Note <300 chars)** and **Variant B (Full Pitch)** with character counters and copy buttons.
- **Dedicated Prompt Pipeline (`src/utils/llm/outreachPrompt.ts`):** Tailored prompts optimized for recruiter and technical audiences with zero-fluff constraints.

### What's Out (Post-MVP):
- Automated auto-messaging bot (never send messages without user review).
- Full multi-step automated drip email campaigns.
- Scraping full private LinkedIn message threads.

## Not Doing (and Why)
- **No Floating In-Situ Overlay:** Injecting floating toolbars directly over LinkedIn's proprietary DraftJS / Lexical message editors is fragile and breaks whenever LinkedIn updates their frontend. The Shadow DOM Drawer is isolated, reliable, and predictable.
- **No Separate Extension Popup Workflow:** Popups in Chrome auto-destroy their state when blurred. Keeping it in the Drawer guarantees your drafts are never lost when you click away to read a profile.

## Open Questions
- Do we want a quick-access shortcut (like a small "Refine Draft" button next to active text areas on LinkedIn) in a future iteration, or is the drawer + `Alt+Shift+Q` shortcut fast enough?
