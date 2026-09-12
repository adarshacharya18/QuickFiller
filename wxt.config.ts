import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'QuickFiller - Local-First Job Application Copilot',
    description: 'Smart job application autofill and copilot powered by local Ollama & cloud LLMs.',
    version: '0.1.0',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
    ],
    host_permissions: [
      'http://localhost:11434/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      '<all_urls>',
    ],
    options_ui: {
      open_in_tab: true,
      page: 'options.html',
    },
  },
});
