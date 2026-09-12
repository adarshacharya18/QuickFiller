import { LLMSettings } from '../../types/llm';
import { callOllama } from './ollama';
import { callGemini, callOpenAI, callAnthropic } from './cloud';

export async function generateAnswer(
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  switch (settings.provider) {
    case 'ollama': {
      const host = settings.ollama.host || 'http://localhost:11434';
      const model = settings.ollama.model || 'llama3.2:3b';
      return await callOllama(host, model, systemPrompt, userPrompt);
    }
    case 'gemini': {
      if (!settings.gemini.apiKey) {
        throw new Error('Google Gemini API key is missing. Please set it in QuickFiller Settings.');
      }
      return await callGemini(
        settings.gemini.apiKey,
        settings.gemini.model,
        systemPrompt,
        userPrompt
      );
    }
    case 'openai': {
      if (!settings.openai.apiKey) {
        throw new Error('OpenAI API key is missing. Please set it in QuickFiller Settings.');
      }
      return await callOpenAI(
        settings.openai.apiKey,
        settings.openai.model,
        systemPrompt,
        userPrompt
      );
    }
    case 'anthropic': {
      if (!settings.anthropic.apiKey) {
        throw new Error('Anthropic API key is missing. Please set it in QuickFiller Settings.');
      }
      return await callAnthropic(
        settings.anthropic.apiKey,
        settings.anthropic.model,
        systemPrompt,
        userPrompt
      );
    }
    default:
      throw new Error(`Unsupported LLM provider: ${settings.provider}`);
  }
}
