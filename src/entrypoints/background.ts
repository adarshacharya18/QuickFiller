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
  cleanCoverLetterOutput,
} from '../utils/llm/coverLetterPrompt';
import {
  buildOutreachSystemPrompt,
  buildOutreachUserPrompt,
  parseOutreachResponse,
} from '../utils/llm/outreachPrompt';
import { isSafeExternalUrl } from '../utils/security';

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
    // Security: Verify message sender is internal to this extension
    if (sender.id && typeof chrome !== 'undefined' && chrome.runtime?.id && sender.id !== chrome.runtime.id) {
      console.warn('[QuickFiller] Rejected message from untrusted sender ID:', sender.id);
      return false;
    }

    if (message?.type === 'INJECT_AND_OPEN_DRAWER' || message?.type === 'INJECT_AND_TOGGLE_DRAWER') {
      const tabId = message.tabId;
      const targetAction = message.type === 'INJECT_AND_TOGGLE_DRAWER' ? 'TOGGLE_DRAWER' : 'OPEN_DRAWER';
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: targetAction })
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

    if (
      message?.type === 'OPEN_JOB_TRACKER' ||
      message?.type === 'OPEN_OPTIONS_TAB' ||
      message?.type === 'OPEN_OPTIONS_PAGE'
    ) {
      const tabName =
        message.tab ||
        (message.type === 'OPEN_JOB_TRACKER'
          ? 'applications'
          : message.type === 'OPEN_OPTIONS_PAGE'
          ? 'profile'
          : undefined);
      const targetUrl = tabName
        ? chrome.runtime.getURL(`options.html?tab=${encodeURIComponent(tabName)}#${encodeURIComponent(tabName)}`)
        : chrome.runtime.getURL('options.html');

      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        chrome.tabs.query({ url: chrome.runtime.getURL('options.html*') })
          .then(async (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
              await chrome.tabs.update(tabs[0].id, { url: targetUrl, active: true });
              if (tabs[0].windowId && chrome.windows?.update) {
                await chrome.windows.update(tabs[0].windowId, { focused: true });
              }
            } else {
              await chrome.tabs.create({ url: targetUrl });
            }
            sendResponse({ success: true });
          })
          .catch(() => {
            chrome.tabs.create({ url: targetUrl });
            sendResponse({ success: true });
          });
        return true;
      } else {
        chrome.tabs.create({ url: targetUrl });
        sendResponse({ success: true });
        return false;
      }
    }

    if (message?.type === 'FETCH_EXTERNAL_JD') {
      const { url } = message;
      if (!url) {
        sendResponse({ success: false, error: 'No URL provided' });
        return false;
      }

      // Security: SSRF validation to prevent access to localhost, private networks, or metadata endpoints
      const safeCheck = isSafeExternalUrl(url);
      if (!safeCheck.safe || !safeCheck.url) {
        sendResponse({ success: false, error: safeCheck.error || 'URL failed security validation' });
        return false;
      }

      fetch(safeCheck.url.toString(), {
        signal: AbortSignal.timeout(10000), // 10-second timeout
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);

          // Security: Validate redirected target URL to prevent SSRF redirect bypass
          if (res.redirected && res.url) {
            const redirectCheck = isSafeExternalUrl(res.url);
            if (!redirectCheck.safe) {
              throw new Error(`SSRF validation rejected redirect target: ${redirectCheck.error || 'Invalid redirect'}`);
            }
          }

          const contentType = res.headers.get('content-type') || '';
          if (
            contentType &&
            !contentType.includes('text/html') &&
            !contentType.includes('text/plain') &&
            !contentType.includes('application/xhtml+xml')
          ) {
            throw new Error(`Invalid content-type: ${contentType}. Only HTML/text pages are supported.`);
          }
          return res.text();
        })
        .then((html) => {
          // Cap HTML string size to 2.5MB to protect memory
          const cappedHtml = html.length > 2500000 ? html.slice(0, 2500000) : html;
          const extracted = extractCleanJDFromHtml(cappedHtml);
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

          const rawAnswer = await generateAnswer(activeSettings, systemPrompt, userPrompt);
          const answer = cleanCoverLetterOutput(rawAnswer);
          sendResponse({ success: true, answer });
        })
        .catch((err) => {
          console.error('[QuickFiller] Cover letter generation error:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (message?.type === 'GENERATE_OUTREACH') {
      const { options, llmSettings } = message;

      getStorageData()
        .then(async (storage) => {
          const activeSettings = llmSettings || storage.llmSettings;
          if (activeSettings?.provider === 'ollama') {
            await setupOllamaDNRRules(activeSettings.ollama?.host);
          }

          const persona = options?.persona || 'recruiter';
          const systemPrompt = buildOutreachSystemPrompt(
            storage.profile,
            persona,
            storage.customPasteBank || []
          );

          const userPrompt = buildOutreachUserPrompt({
            ...options,
            candidateProfile: storage.profile,
            pasteBank: storage.customPasteBank || [],
          });

          const rawAnswer = await generateAnswer(activeSettings, systemPrompt, userPrompt);
          const result = parseOutreachResponse(rawAnswer, persona);
          sendResponse({ success: true, result });
        })
        .catch((err) => {
          console.error('[QuickFiller] Outreach generation error:', err);
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

          let userPrompt = `Job Application Question:\n<screening_question>\n${questionPrompt}\n</screening_question>`;

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
