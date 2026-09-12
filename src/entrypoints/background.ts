import { defineBackground } from 'wxt/utils/define-background';
import { getStorageData } from '../utils/storage';
import { fetchOllamaModels } from '../utils/llm/ollama';
import { generateAnswer } from '../utils/llm';
import { buildSystemPrompt } from '../utils/llm/prompt';
import { setupOllamaDNRRules } from '../utils/rules';

export default defineBackground(() => {
  console.log('[QuickFiller] Background Service Worker initialized.');

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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
