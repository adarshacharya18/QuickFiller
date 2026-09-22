import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  manifest: {
    name: 'QuickFiller - Job Application Copilot',
    description: 'Smart job application autofill and copilot powered by local Ollama & cloud LLMs.',
    version: '1.0.0',
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_title: 'QuickFiller',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
        48: 'icon-48.png',
        128: 'icon-128.png',
      },
    },
    browser_specific_settings: {
      gecko: {
        id: 'quickfiller@adarshacharya.dev',
        strict_min_version: '109.0',
      },
    },
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
