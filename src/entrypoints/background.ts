import { defineBackground } from 'wxt/utils/define-background';
import { getStorageData } from '../utils/storage';
import { fetchOllamaModels } from '../utils/llm/ollama';
import { generateAnswer } from '../utils/llm';
import { buildSystemPrompt } from '../utils/llm/prompt';
import { setupOllamaDNRRules } from '../utils/rules';
import { extractCleanJDFromHtml, isValidJobDescription } from '../utils/jdResolver';
import {
  buildCoverLetterSystemPrompt,
  buildCoverLetterUserPrompt,
} from '../utils/llm/coverLetterPrompt';

export default defineBackground(() => {
  console.log('[QuickFiller] Background Service Worker initialized.');

  // Track tab lineage / opener origin for new tabs opened from job postings
  const tabSourceUrls = new Map<number, string>();

  if (typeof chrome !== 'undefined' && chrome.tabs?.onCreated) {
    chrome.tabs.onCreated.addListener(async (tab) => {
      if (tab.id && tab.openerTabId) {
        try {
          const opener = await chrome.tabs.get(tab.openerTabId);
          if (opener.url) {
            tabSourceUrls.set(tab.id, opener.url);
          }
        } catch {
          // Tab opener may have closed
        }
      }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      tabSourceUrls.delete(tabId);
    });
  }

  // Handle Alt+Shift+Q keyboard shortcut to toggle Copilot Drawer on active tab
  if (typeof chrome !== 'undefined' && chrome.commands?.onCommand) {
    chrome.commands.onCommand.addListener(async (command) => {
      if (command === 'toggle_drawer') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url && !tab.url.startsWith('chrome://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_DRAWER' });
          } catch {
            // In on-click mode, dynamically inject content script if not yet loaded
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  (window as any).__QUICKFILLER_AUTO_OPEN__ = true;
                },
              });
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content-scripts/content.js'],
              });
            } catch (err) {
              console.error('[QuickFiller] Could not inject content script on shortcut:', err);
            }
          }
        }
      }
    });
  }

  // Initialize Declarative Net Request rules to prevent 403 Forbidden CORS issues with Ollama
  getStorageData().then((storage) => {
    const host = storage.llmSettings?.ollama?.host || 'http://localhost:11434';
    setupOllamaDNRRules(host);
  }).catch(() => {
    setupOllamaDNRRules();
  });

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.llmSettings?.newValue?.ollama?.host) {
        setupOllamaDNRRules(changes.llmSettings.newValue.ollama.host);
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'INJECT_AND_TOGGLE_DRAWER') {
      const tabId = message.tabId;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_DRAWER' })
          .then(() => sendResponse({ success: true }))
          .catch(async () => {
            try {
              await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                  (window as any).__QUICKFILLER_AUTO_OPEN__ = true;
                },
              });
              await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content-scripts/content.js'],
              });
              sendResponse({ success: true, injected: true });
            } catch (err: any) {
              sendResponse({ success: false, error: err.message });
            }
          });
        return true;
      }
    }

    if (message?.type === 'GET_TAB_SOURCE_URL') {
      const tabId = sender.tab?.id;
      const url = tabId ? tabSourceUrls.get(tabId) : undefined;
      sendResponse({ success: Boolean(url), url });
      return false;
    }

    if (message?.type === 'FETCH_EXTERNAL_JD') {
      const { url } = message;
      if (!url) {
        sendResponse({ success: false, error: 'No URL provided' });
        return false;
      }

      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          return res.text();
        })
        .then((html) => {
          const extracted = extractCleanJDFromHtml(html);
          const isValid = isValidJobDescription(extracted.jdText);
          sendResponse({
            success: true,
            title: extracted.title,
            jdText: extracted.jdText,
            isValid,
          });
        })
        .catch((err) => {
          console.error('[QuickFiller] External JD fetch error:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (message?.type === 'GENERATE_COVER_LETTER') {
      const { options, llmSettings } = message;

      getStorageData()
        .then(async (storage) => {
          const activeSettings = llmSettings || storage.llmSettings;
          if (activeSettings?.provider === 'ollama') {
            await setupOllamaDNRRules(activeSettings.ollama?.host);
          }

          const systemPrompt = buildCoverLetterSystemPrompt(
            storage.profile,
            storage.customPasteBank || []
          );

          const userPrompt = buildCoverLetterUserPrompt(options);

          const answer = await generateAnswer(activeSettings, systemPrompt, userPrompt);
          sendResponse({ success: true, answer });
        })
        .catch((err) => {
          console.error('[QuickFiller] Cover letter generation error:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (message?.type === 'CHECK_OLLAMA') {
      const host = message.host || 'http://localhost:11434';
      setupOllamaDNRRules(host).then(() => {
        return fetchOllamaModels(host);
      })
        .then((models) => sendResponse({ success: true, models }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Keep message channel open for async response
    }

    if (message?.type === 'GENERATE_ANSWER') {
      const {
        questionPrompt,
        placeholder,
        isTextarea,
        jobContext,
        customInstructions,
        llmSettings,
      } = message;

      getStorageData()
        .then(async (storage) => {
          const activeSettings = llmSettings || storage.llmSettings;
          if (activeSettings?.provider === 'ollama') {
            await setupOllamaDNRRules(activeSettings.ollama?.host);
          }

          const systemPrompt = buildSystemPrompt(
            storage.profile,
            storage.wizardAnswers,
            storage.questionBank,
            jobContext,
            storage.customPasteBank || []
          );

          let userPrompt = `Job Application Question:\n"${questionPrompt}"`;

          if (placeholder) {
            userPrompt += `\nExpected Format / Example: "${placeholder}"`;
          }

          if (isTextarea === false) {
            userPrompt += `\nField Input Type: Single-line input field. Output MUST be short, concise, and directly match the placeholder format (1 short line, maximum 10-15 words, NO paragraphs or letters).`;
          } else if (isTextarea === true) {
            userPrompt += `\nField Input Type: Multi-line textarea. Provide a well-structured, detailed 1-3 paragraph answer.`;
          }

          if (customInstructions) {
            userPrompt += `\n\nSpecific Instruction: ${customInstructions}`;
          }

          const answer = await generateAnswer(activeSettings, systemPrompt, userPrompt);
          sendResponse({ success: true, answer });
        })
        .catch((err) => {
          console.error('[QuickFiller] Generation error:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    return false;
  });
});
