export type LLMProvider = 'ollama' | 'gemini' | 'openai' | 'anthropic';

export interface OllamaConfig {
  host: string;
  model: string;
}

export interface CloudLLMConfig {
  apiKey: string;
  model: string;
}

export interface LLMSettings {
  provider: LLMProvider;
  ollama: OllamaConfig;
  gemini: CloudLLMConfig;
  openai: CloudLLMConfig;
  anthropic: CloudLLMConfig;
}

export const defaultLLMSettings: LLMSettings = {
  provider: 'ollama',
  ollama: {
    host: 'http://localhost:11434',
    model: 'llama3.2:3b',
  },
  gemini: {
    apiKey: '',
    model: 'gemini-1.5-flash',
  },
  openai: {
    apiKey: '',
    model: 'gpt-4o-mini',
  },
  anthropic: {
    apiKey: '',
    model: 'claude-3-5-haiku-20241022',
  },
};
