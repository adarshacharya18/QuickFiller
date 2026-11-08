import { LLMProvider } from '../../types/llm';
import { redactSecrets } from '../security';
import { fetchOllamaModels } from './ollama';

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  category?: 'recommended' | 'reasoning' | 'fast' | 'general';
}

export const CURATED_MODELS: Record<LLMProvider, ModelOption[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Latest reasoning & high speed', category: 'recommended' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast multimodal workhorse', category: 'recommended' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Lightweight & versatile', category: 'fast' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Deep reasoning & 2M context', category: 'reasoning' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Ultra-fast & economical', category: 'fast' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & cost-effective (Default)', category: 'recommended' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship multimodal', category: 'recommended' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Next-generation workhorse', category: 'recommended' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Ultra-fast next-gen', category: 'fast' },
    { id: 'o3-mini', name: 'o3-mini', description: 'Fast reasoning & STEM', category: 'reasoning' },
    { id: 'o1', name: 'o1', description: 'Deep reasoning model', category: 'reasoning' },
  ],
  anthropic: [
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Latest hybrid reasoning flagship', category: 'recommended' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Industry-standard writing & coding', category: 'recommended' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast & responsive default', category: 'fast' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Deep complex analysis', category: 'reasoning' },
  ],
  ollama: [
    { id: 'llama3.2:3b', name: 'llama3.2:3b', description: 'Lightweight & fast (Default)', category: 'recommended' },
    { id: 'llama3.3:70b', name: 'llama3.3:70b', description: 'High-intelligence open weights', category: 'reasoning' },
    { id: 'llama3.1:8b', name: 'llama3.1:8b', description: 'Standard high-quality open model', category: 'general' },
    { id: 'qwen2.5:7b', name: 'qwen2.5:7b', description: 'Strong multilingual & reasoning', category: 'recommended' },
    { id: 'deepseek-r1:7b', name: 'deepseek-r1:7b', description: 'Local chain-of-thought reasoning', category: 'reasoning' },
    { id: 'deepseek-r1:8b', name: 'deepseek-r1:8b', description: 'Local chain-of-thought reasoning', category: 'reasoning' },
    { id: 'mistral:7b', name: 'mistral:7b', description: 'Fast general-purpose assistant', category: 'fast' },
  ],
};

export async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Gemini API key is required to discover available models.');
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000';
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': cleanKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${redactSecrets(errorText, [cleanKey])}`);
    }

    const data = await response.json();
    const modelsList: any[] = Array.isArray(data.models) ? data.models : [];

    const discovered = modelsList
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => (m.name || '').replace(/^models\//, '').trim())
      .filter((name) => Boolean(name));

    return Array.from(new Set(discovered)).sort();
  } catch (err: any) {
    throw new Error(redactSecrets(err.message, [cleanKey]));
  }
}

export async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('OpenAI API key is required to discover available models.');
  }

  const url = 'https://api.openai.com/v1/models';
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${redactSecrets(errorText, [cleanKey])}`);
    }

    const data = await response.json();
    const modelsList: any[] = Array.isArray(data.data) ? data.data : [];

    const excludedSubstrings = [
      'whisper',
      'tts',
      'embedding',
      'dall-e',
      'moderation',
      'realtime',
      'audio',
      'babbage',
      'davinci',
    ];

    const discovered = modelsList
      .map((m) => (m.id || '').trim())
      .filter((id) => {
        if (!id) return false;
        const lower = id.toLowerCase();
        if (excludedSubstrings.some((sub) => lower.includes(sub))) return false;
        return (
          lower.startsWith('gpt-') ||
          lower.startsWith('o1') ||
          lower.startsWith('o3') ||
          lower.startsWith('o4') ||
          lower.startsWith('chatgpt-') ||
          lower.startsWith('ft:')
        );
      });

    return Array.from(new Set(discovered)).sort();
  } catch (err: any) {
    throw new Error(redactSecrets(err.message, [cleanKey]));
  }
}

export async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Anthropic API key is required to discover available models.');
  }

  const url = 'https://api.anthropic.com/v1/models?limit=1000';
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${redactSecrets(errorText, [cleanKey])}`);
    }

    const data = await response.json();
    const modelsList: any[] = Array.isArray(data.data) ? data.data : [];

    const discovered = modelsList
      .map((m) => (m.id || '').trim())
      .filter((id) => Boolean(id));

    return Array.from(new Set(discovered)).sort();
  } catch (err: any) {
    throw new Error(redactSecrets(err.message, [cleanKey]));
  }
}

export async function fetchProviderModels(
  provider: LLMProvider,
  config: { apiKey?: string; host?: string }
): Promise<string[]> {
  switch (provider) {
    case 'ollama':
      return fetchOllamaModels(config.host || 'http://localhost:11434');
    case 'gemini':
      return fetchGeminiModels(config.apiKey || '');
    case 'openai':
      return fetchOpenAIModels(config.apiKey || '');
    case 'anthropic':
      return fetchAnthropicModels(config.apiKey || '');
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
