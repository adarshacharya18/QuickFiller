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
      'declarativeNetRequest',
    ],
    host_permissions: [
      'http://localhost:11434/*',
      'http://127.0.0.1:11434/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      '<all_urls>',
    ],
    commands: {
      toggle_drawer: {
        suggested_key: {
          default: 'Alt+Shift+Q',
          mac: 'Alt+Shift+Q',
        },
        description: 'Toggle QuickFiller Copilot Drawer on current page',
      },
    },
    declarative_net_request: {
      rule_resources: [
        {
          id: 'ruleset_ollama',
          enabled: true,
          path: 'rules.json',
        },
      ],
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; frame-ancestors 'none';",
    },
    options_ui: {
      open_in_tab: true,
      page: 'options.html',
    },
  },
});
