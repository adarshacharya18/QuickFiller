import { defineBackground } from 'wxt/utils/define-background';
import { getStorageData } from '../utils/storage';
import { fetchOllamaModels } from '../utils/llm/ollama';
import { generateAnswer } from '../utils/llm';
import { buildSystemPrompt } from '../utils/llm/prompt';

export default defineBackground(() => {
  console.log('[QuickFiller] Background Service Worker initialized.');

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'CHECK_OLLAMA') {
      const host = message.host || 'http://localhost:11434';
      fetchOllamaModels(host)
        .then((models) => sendResponse({ success: true, models }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Keep message channel open for async response
    }

    if (message?.type === 'GENERATE_ANSWER') {
      const { questionPrompt, jobContext, customInstructions } = message;
      getStorageData()
        .then(async (storage) => {
          const systemPrompt = buildSystemPrompt(
            storage.profile,
            storage.wizardAnswers,
            storage.questionBank,
            jobContext
          );

          let userPrompt = `Job Application Question:\n"${questionPrompt}"`;
          if (customInstructions) {
            userPrompt += `\n\nSpecific Instruction: ${customInstructions}`;
          }

          const answer = await generateAnswer(storage.llmSettings, systemPrompt, userPrompt);
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
