import { defineBackground } from 'wxt/utils/define-background';
import { getStorageData } from '../utils/storage';
import { fetchOllamaModels } from '../utils/llm/ollama';
import { generateAnswer } from '../utils/llm';
import { buildSystemPrompt, cleanAnswerOutput } from '../utils/llm/prompt';
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
import { isSensitiveOrInternalUrl } from '../utils/drawerUtils';

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

  const getGlobalBrowser = () => (globalThis as any).browser;
  const getTabsApi = () => getGlobalBrowser()?.tabs || chrome.tabs;

  const queryTabsSafely = async (queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => {
    return new Promise((resolve) => {
      try {
        const tabsApi = getTabsApi();
        const res = tabsApi?.query(queryInfo, (tabs: chrome.tabs.Tab[]) => {
          if (chrome.runtime?.lastError) resolve([]);
          else resolve(tabs || []);
        });
        if (res && typeof (res as any).then === 'function') {
          (res as any).then((tabs: chrome.tabs.Tab[]) => resolve(tabs || [])).catch(() => resolve([]));
        }
      } catch {
        resolve([]);
      }
    });
  };

  const getTabSafely = async (tabId: number): Promise<chrome.tabs.Tab | null> => {
    return new Promise((resolve) => {
      try {
        const tabsApi = getTabsApi();
        const res = tabsApi?.get(tabId, (tab: chrome.tabs.Tab) => {
          if (chrome.runtime?.lastError) resolve(null);
          else resolve(tab || null);
        });
        if (res && typeof (res as any).then === 'function') {
          (res as any).then((tab: chrome.tabs.Tab) => resolve(tab || null)).catch(() => resolve(null));
        }
      } catch {
        resolve(null);
      }
    });
  };

  const sendTabMessageSafely = async (tabId: number, msg: any): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const tabsApi = getTabsApi();
        const res = tabsApi?.sendMessage(tabId, msg, (response: any) => {
          if (chrome.runtime?.lastError || !response) resolve(false);
          else resolve(true);
        });
        if (res && typeof (res as any).then === 'function') {
          (res as any).then(() => resolve(true)).catch(() => resolve(false));
        }
      } catch {
        resolve(false);
      }
    });
  };

  const injectContentScriptSafely = async (tabId: number, autoOpen = true): Promise<void> => {
    const tabsApi = getTabsApi();

    // MV3 chrome.scripting
    if (chrome.scripting?.executeScript) {
      if (autoOpen) {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            (window as any).__QUICKFILLER_AUTO_OPEN__ = true;
          },
        });
      }
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
      return;
    }

    // MV2 tabs.executeScript (Firefox)
    if (tabsApi?.executeScript) {
      if (autoOpen) {
        await new Promise<void>((resolve) => {
          try {
            const res = tabsApi.executeScript(tabId, { code: 'window.__QUICKFILLER_AUTO_OPEN__ = true;' }, () => resolve());
            if (res && typeof (res as any).then === 'function') (res as any).then(() => resolve()).catch(() => resolve());
          } catch {
            resolve();
          }
        });
      }

      await new Promise<void>((resolve, reject) => {
        try {
          const res = tabsApi.executeScript(tabId, { file: 'content-scripts/content.js' }, () => {
            if (chrome.runtime?.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
          });
          if (res && typeof (res as any).then === 'function') (res as any).then(() => resolve()).catch(reject);
        } catch (err) {
          reject(err);
        }
      });
      return;
    }

    throw new Error('No script injection API available');
  };

  // Handle Alt+Shift+Q keyboard shortcut to toggle Copilot Drawer on active tab
  if (typeof chrome !== 'undefined' && chrome.commands?.onCommand) {
    chrome.commands.onCommand.addListener(async (command) => {
      if (command === 'toggle_drawer') {
        const tabs = await queryTabsSafely({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id && tab.url && !isSensitiveOrInternalUrl(tab.url)) {
          const sent = await sendTabMessageSafely(tab.id, { type: 'TOGGLE_DRAWER' });
          if (!sent) {
            try {
              await injectContentScriptSafely(tab.id, true);
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
        (async () => {
          try {
            const tab = await getTabSafely(tabId);
            if (tab?.url && isSensitiveOrInternalUrl(tab.url)) {
              sendResponse({ success: false, error: 'Cannot open QuickFiller on sensitive authentication page' });
              return;
            }
            const sent = await sendTabMessageSafely(tabId, { type: targetAction });
            if (sent) {
              sendResponse({ success: true });
              return;
            }
            await injectContentScriptSafely(tabId, true);
            sendResponse({ success: true, injected: true });
          } catch (err: any) {
            sendResponse({ success: false, error: err?.message || 'Injection failed' });
          }
        })();
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

      const openTabSafely = async () => {
        try {
          const globalBrowser = (globalThis as any).browser;
          const tabsApi = globalBrowser?.tabs ? globalBrowser.tabs : chrome.tabs;
          let existingTabId: number | undefined;
          let existingWinId: number | undefined;

          // Attempt to find already open options tab
          if (tabsApi?.query) {
            try {
              const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
                try {
                  const res = tabsApi.query({}, (tabsList: chrome.tabs.Tab[]) => {
                    if (chrome.runtime?.lastError) resolve([]);
                    else resolve(tabsList || []);
                  });
                  if (res && typeof (res as any).then === 'function') {
                    (res as any).then((list: chrome.tabs.Tab[]) => resolve(list || [])).catch(() => resolve([]));
                  }
                } catch {
                  resolve([]);
                }
              });

              const found = tabs.find((t) => t.url && t.url.includes('options.html'));
              if (found?.id) {
                existingTabId = found.id;
                existingWinId = found.windowId;
              }
            } catch {
              // Ignore query errors
            }
          }

          if (existingTabId) {
            try {
              await new Promise<void>((resolve) => {
                const res = tabsApi.update(existingTabId!, { url: targetUrl, active: true }, () => resolve());
                if (res && typeof (res as any).then === 'function') {
                  (res as any).then(() => resolve()).catch(() => resolve());
                }
              });
              if (existingWinId) {
                const winApi = globalBrowser?.windows ? globalBrowser.windows : chrome.windows;
                winApi?.update?.(existingWinId, { focused: true });
              }
              sendResponse({ success: true });
              return;
            } catch {
              // If update fails, fall through to create
            }
          }

          // Fallback: create a new tab
          if (tabsApi?.create) {
            tabsApi.create({ url: targetUrl }, () => {
              sendResponse({ success: true });
            });
          } else {
            chrome.tabs.create({ url: targetUrl });
            sendResponse({ success: true });
          }
        } catch {
          try {
            chrome.tabs.create({ url: targetUrl });
          } catch {}
          sendResponse({ success: true });
        }
      };

      openTabSafely();
      return true;
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
              company: extracted.company,
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

          userPrompt += `\n\nCRITICAL: Output ONLY the direct answer text. Do NOT wrap your answer in XML tags like <screening_answer> or </screening_answer>. Do NOT use markdown code blocks.`;

          const rawAnswer = await generateAnswer(activeSettings, systemPrompt, userPrompt);
          const answer = cleanAnswerOutput(rawAnswer);
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
