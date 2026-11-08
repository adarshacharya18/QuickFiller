import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CURATED_MODELS,
  fetchGeminiModels,
  fetchOpenAIModels,
  fetchAnthropicModels,
  fetchProviderModels,
} from '../src/utils/llm/discovery';
import { callGemini, callOpenAI, callAnthropic } from '../src/utils/llm/cloud';

describe('LLM Discovery & Modern Models Catalog', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Curated Latest Models Catalog', () => {
    it('provides modern 2025/2026 models for Google Gemini', () => {
      const ids = CURATED_MODELS.gemini.map((m) => m.id);
      expect(ids).toContain('gemini-2.5-flash');
      expect(ids).toContain('gemini-2.0-flash');
      expect(ids).toContain('gemini-1.5-flash');
      expect(ids).toContain('gemini-1.5-pro');
      expect(ids).toContain('gemini-2.0-flash-lite');
    });

    it('provides modern models and reasoning models for OpenAI', () => {
      const ids = CURATED_MODELS.openai.map((m) => m.id);
      expect(ids).toContain('gpt-4o-mini');
      expect(ids).toContain('gpt-4o');
      expect(ids).toContain('gpt-4.1');
      expect(ids).toContain('o3-mini');
      expect(ids).toContain('o1');
    });

    it('provides Claude 3.7 and Claude 3.5 models for Anthropic', () => {
      const ids = CURATED_MODELS.anthropic.map((m) => m.id);
      expect(ids).toContain('claude-3-7-sonnet-20250219');
      expect(ids).toContain('claude-3-5-sonnet-20241022');
      expect(ids).toContain('claude-3-5-haiku-20241022');
    });

    it('provides high quality lightweight and reasoning models for Ollama', () => {
      const ids = CURATED_MODELS.ollama.map((m) => m.id);
      expect(ids).toContain('llama3.2:3b');
      expect(ids).toContain('llama3.3:70b');
      expect(ids).toContain('deepseek-r1:7b');
      expect(ids).toContain('qwen2.5:7b');
    });
  });

  describe('Gemini Model Discovery (fetchGeminiModels)', () => {
    it('throws when API key is missing or blank', async () => {
      await expect(fetchGeminiModels('')).rejects.toThrow('Gemini API key is required');
      await expect(fetchGeminiModels('   ')).rejects.toThrow('Gemini API key is required');
    });

    it('successfully extracts, filters, strips models/ prefix and sorts Gemini content models', async () => {
      const fakeApiResponse = {
        models: [
          {
            name: 'models/gemini-2.5-flash',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/gemini-2.0-flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/text-embedding-004',
            supportedGenerationMethods: ['embedContent'], // Non-generation model
          },
          {
            name: 'models/aqa',
            supportedGenerationMethods: ['generateAnswer'], // Non-generateContent
          },
          {
            name: 'models/gemini-1.5-pro',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse,
      } as any);

      const models = await fetchGeminiModels('AIzaFakeKey123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
        expect.objectContaining({
          method: 'GET',
          headers: { 'x-goog-api-key': 'AIzaFakeKey123' },
        })
      );

      expect(models).toEqual(['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash']);
      expect(models).not.toContain('text-embedding-004');
      expect(models).not.toContain('aqa');
    });

    it('redacts sensitive API key if API request fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid key: AIzaSecretKey999 provided in x-goog-api-key',
      } as any);

      await expect(fetchGeminiModels('AIzaSecretKey999')).rejects.toThrow(/\[REDACTED_SECRET\]/);
    });
  });

  describe('OpenAI Model Discovery (fetchOpenAIModels)', () => {
    it('throws when API key is missing or blank', async () => {
      await expect(fetchOpenAIModels('')).rejects.toThrow('OpenAI API key is required');
    });

    it('filters out non-chat models (audio, tts, embeddings, whisper) and includes chat & reasoning models', async () => {
      const fakeApiResponse = {
        data: [
          { id: 'gpt-4o' },
          { id: 'gpt-4o-mini' },
          { id: 'o3-mini' },
          { id: 'o1' },
          { id: 'text-embedding-3-small' },
          { id: 'tts-1' },
          { id: 'whisper-1' },
          { id: 'dall-e-3' },
          { id: 'ft:gpt-4o-mini:my-org::abc123' },
          { id: 'text-moderation-latest' },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse,
      } as any);

      const models = await fetchOpenAIModels('sk-testkey123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer sk-testkey123' },
        })
      );

      expect(models).toContain('gpt-4o');
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('o3-mini');
      expect(models).toContain('o1');
      expect(models).toContain('ft:gpt-4o-mini:my-org::abc123');

      expect(models).not.toContain('text-embedding-3-small');
      expect(models).not.toContain('tts-1');
      expect(models).not.toContain('whisper-1');
      expect(models).not.toContain('dall-e-3');
      expect(models).not.toContain('text-moderation-latest');
    });

    it('redacts sensitive API key on error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Incorrect API key sk-secret12345',
      } as any);

      await expect(fetchOpenAIModels('sk-secret12345')).rejects.toThrow(/\[REDACTED_SECRET\]/);
    });
  });

  describe('Anthropic Model Discovery (fetchAnthropicModels)', () => {
    it('throws when API key is missing', async () => {
      await expect(fetchAnthropicModels('')).rejects.toThrow('Anthropic API key is required');
    });

    it('sends anthropic-dangerous-direct-browser-access header and returns model list', async () => {
      const fakeApiResponse = {
        data: [
          { id: 'claude-3-7-sonnet-20250219' },
          { id: 'claude-3-5-sonnet-20241022' },
          { id: 'claude-3-5-haiku-20241022' },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeApiResponse,
      } as any);

      const models = await fetchAnthropicModels('sk-ant-fake999');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/models?limit=1000',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-api-key': 'sk-ant-fake999',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          }),
        })
      );

      expect(models).toEqual([
        'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20241022',
        'claude-3-7-sonnet-20250219',
      ]);
    });
  });

  describe('fetchProviderModels Dispatcher', () => {
    it('dispatches to Ollama model fetching', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:3b' }, { name: 'mistral:latest' }],
        }),
      } as any);

      const models = await fetchProviderModels('ollama', { host: 'http://localhost:11434' });
      expect(models).toEqual(['llama3.2:3b', 'mistral:latest']);
    });

    it('rejects unsupported provider', async () => {
      await expect(fetchProviderModels('unknown' as any, {})).rejects.toThrow('Unsupported LLM provider');
    });
  });

  describe('OpenAI Reasoning Models API Compatibility (callOpenAI)', () => {
    it('omits temperature and uses max_completion_tokens for o3-mini and o1 models', async () => {
      let sentBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        sentBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Reasoned answer' } }],
          }),
        };
      });

      await callOpenAI('sk-test', 'o3-mini', 'System prompt', 'User prompt');

      expect(sentBody).toBeDefined();
      expect(sentBody.model).toBe('o3-mini');
      expect(sentBody.max_completion_tokens).toBe(1000);
      expect(sentBody.temperature).toBeUndefined();
      expect(sentBody.max_tokens).toBeUndefined();

      // Test o1 model
      await callOpenAI('sk-test', 'o1', 'System prompt', 'User prompt');
      expect(sentBody.model).toBe('o1');
      expect(sentBody.max_completion_tokens).toBe(1000);
      expect(sentBody.temperature).toBeUndefined();
    });

    it('includes temperature and max_tokens for standard chat models (gpt-4o, gpt-4o-mini)', async () => {
      let sentBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        sentBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Standard answer' } }],
          }),
        };
      });

      await callOpenAI('sk-test', 'gpt-4o-mini', 'System prompt', 'User prompt');

      expect(sentBody).toBeDefined();
      expect(sentBody.model).toBe('gpt-4o-mini');
      expect(sentBody.temperature).toBe(0.4);
      expect(sentBody.max_tokens).toBe(1000);
      expect(sentBody.max_completion_tokens).toBeUndefined();
    });
  });

  describe('Anthropic Browser Header Compatibility (callAnthropic)', () => {
    it('includes anthropic-dangerous-direct-browser-access header in messages call', async () => {
      let sentHeaders: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        sentHeaders = options.headers;
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Anthropic reply' }],
          }),
        };
      });

      await callAnthropic('sk-ant-test', 'claude-3-7-sonnet-20250219', 'Sys prompt', 'User prompt');

      expect(sentHeaders).toBeDefined();
      expect(sentHeaders['anthropic-dangerous-direct-browser-access']).toBe('true');
      expect(sentHeaders['x-api-key']).toBe('sk-ant-test');
    });
  });

  describe('Google Gemini Fast Execution & Model Sanitization (callGemini)', () => {
    it('strips accidental models/ prefix and encodes clean model path in URL', async () => {
      let requestedUrl = '';
      let sentBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
        requestedUrl = url.toString();
        sentBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Connection successful!' }] } }],
          }),
        };
      });

      await callGemini('AIzaTestKey', 'models/gemini-2.0-flash', 'System prompt', 'User prompt', {
        maxTokens: 16,
      });

      expect(requestedUrl).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
      );
      expect(sentBody.generationConfig.maxOutputTokens).toBe(16);
    });

    it('sets thinkingBudget: 0 for Gemini 2.5 models during quick connection tests', async () => {
      let sentBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        sentBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { thought: true, text: 'Thinking about testing connection...' },
                    { text: 'Connection successful!' },
                  ],
                },
              },
            ],
          }),
        };
      });

      const result = await callGemini(
        'AIzaTestKey',
        'gemini-2.5-flash',
        'System prompt',
        'User prompt',
        { maxTokens: 100 }
      );

      expect(sentBody.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
      expect(result).toBe('Connection successful!');
    });

    it('extracts non-thought text part when model returns reasoning/thought parts', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: 'Internal reasoning...' },
                  { text: 'Final Answer' },
                ],
              },
            },
          ],
        }),
      } as any);

      const answer = await callGemini('AIzaTestKey', 'gemini-2.5-pro', 'sys', 'usr');
      expect(answer).toBe('Final Answer');
    });

    it('handles and redacts secrets in detailed JSON error responses from Gemini', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            error: {
              code: 404,
              message: 'models/custom-model-xyz is not found for API version v1beta',
              status: 'NOT_FOUND',
            },
          }),
      } as any);

      await expect(
        callGemini('AIzaSecretKey123', 'custom-model-xyz', 'sys', 'usr')
      ).rejects.toThrow('Gemini error (404): models/custom-model-xyz is not found');
    });

    it('uses 1000 max tokens by default when maxTokens option is not specified', async () => {
      let sentBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        sentBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Standard reply' }] } }],
          }),
        };
      });

      await callGemini('AIzaTestKey', 'gemini-1.5-flash', 'System prompt', 'User prompt');

      expect(sentBody.generationConfig.maxOutputTokens).toBe(1000);
    });
  });
});
