# ⚡ QuickFiller

> **A 100% local-first, open-source job application copilot and autofill extension for Chromium browsers.**  
> Powered by local AI (**Ollama**) or Bring-Your-Own-Key cloud LLMs (**Google Gemini, OpenAI, Claude**).

---

## 🌟 Why QuickFiller?

Applying for jobs is frustratingly repetitive. Most autofill extensions suffer from two major flaws:
1. **Privacy nightmare:** They upload your sensitive personal data, resume, phone number, and salary history to third-party proprietary servers.
2. **Fragile on modern ATS platforms:** Multi-step wizards and custom forms (Greenhouse, Lever, Workday) frequently reject standard browser autofill, and complex screening questions (*"Why do you want to work here?"*, *"Describe a time..."*) still require manual typing.

**QuickFiller solves both:**
- **🔒 100% Local-First:** Your resume, contact details, and past answers never leave your browser (`chrome.storage.local`). Zero telemetry, zero servers.
- **🦙 Run on Local AI:** Native zero-cost integration with local models via **Ollama** (`llama3.2:3b`, `qwen2.5`, etc.), with support for BYOK cloud APIs (Gemini Flash, OpenAI, Claude).
- **📄 Deep Resume & Link Harvester:** Client-side PDF parser extracts both visible text and embedded PDF hyperlink annotations (portfolio, GitHub, projects).
- **🎯 Resilient Copilot Drawer:** Injected into any web page inside an isolated **Shadow DOM** (zero CSS bleeding). Fills standard inputs in 1 click and drafts high-impact answers for custom screening questions with 1-click insert and copy buttons.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18+) or **Bun**
- *(Optional for 100% local AI)*: [Ollama](https://ollama.com/) running locally:
  ```bash
  ollama run llama3.2:3b
  ```

### 2. Install & Build
```bash
# Clone the repository
git clone https://github.com/your-username/QuickFiller.git
cd QuickFiller

# Install dependencies
npm install

# Build the extension
npm run build
```

The compiled extension will be output to `.output/chrome-mv3`.

### 3. Load in Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `.output/chrome-mv3` folder inside this project.
5. Pin **QuickFiller** from your browser extensions menu!

---

## 🛠️ Testing Locally

QuickFiller includes a realistic job application page (`test-form.html`) so you can test the extension immediately without navigating to a live job board:

1. Open `test-form.html` in Chrome:
   ```bash
   # Open directly in Chrome
   google-chrome test-form.html
   ```
2. Click the **QuickFiller** extension icon in your toolbar and click **Open Profile & Settings**.
3. Upload a PDF resume or fill in your details and standard screening answers (work authorization, notice period, salary).
4. Go back to `test-form.html` — notice the floating **QuickFiller** launcher button!
5. Click it to open the Copilot Drawer:
   - Click **Fill All** to populate Name, Email, Phone, LinkedIn, and Portfolio.
   - Click **Draft Answer** on the custom questions to generate AI responses using your local Ollama model!
   - Click **Insert** to inject the answers directly into the form.

---

## 🏗️ Architecture

```
QuickFiller/
├── src/
│   ├── entrypoints/
│   │   ├── background.ts      # MV3 Service Worker (Ollama & Cloud LLM router)
│   │   ├── content/           # Injected content script & Shadow DOM Copilot Drawer
│   │   │   ├── index.tsx      # ShadowRoot UI mount point
│   │   │   ├── Drawer.tsx     # Interactive Copilot Drawer component
│   │   │   └── styles.css     # Isolated Tailwind styles
│   │   ├── options/           # Full-page Profile & Configuration Dashboard
│   │   │   ├── App.tsx        # Dashboard shell
│   │   │   ├── ProfileTab.tsx # PDF resume parser & link harvester
│   │   │   ├── QuestionsTab.tsx # Screening Q&A Bank & legal wizard
│   │   │   └── SettingsTab.tsx  # Ollama & BYOK LLM manager
│   │   └── popup/             # Extension popup action
│   ├── types/                 # TypeScript schemas (profile, questions, LLM, storage)
│   └── utils/
│       ├── autofill.ts        # Synthetic event dispatcher (bypasses React/Angular traps)
│       ├── scanner.ts         # Heuristic DOM scanner & job metadata extractor
│       ├── pdfParser.ts       # Client-side PDF text & annotation link parser
│       ├── storage.ts         # Type-safe chrome.storage.local wrapper
│       └── llm/               # Ollama, Gemini, OpenAI, Anthropic clients
├── docs/
│   └── ideas/
│       └── quickfiller.md     # Official project idea one-pager & specification
├── test-form.html             # Mock job application test suite
├── wxt.config.ts              # Web Extension Framework configuration
└── package.json
```

---

## 🛡️ Privacy & Security

- **No Remote Tracking:** QuickFiller contains zero analytics, tracking pixels, or remote database syncs.
- **Local Storage:** All profile information and API keys are stored in Chrome's local protected sandbox (`chrome.storage.local`).
- **Ollama Offline Mode:** When using Ollama, your application data never leaves your computer.

---

## 📜 License

MIT License. Open source and free for personal and commercial use.
