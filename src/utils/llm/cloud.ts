import { redactSecrets } from '../security';

export async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Gemini API key is not configured. Please set your key in Options.');
  }

  const rawModel = (model || 'gemini-1.5-flash').trim();
  // Strip any accidental 'models/' prefix so URL is always correctly structured
  const cleanModel = rawModel.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;
  const maxTokens = options?.maxTokens ?? 1000;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: maxTokens,
          ...(/2\.5/i.test(cleanModel) && maxTokens <= 100
            ? { thinkingConfig: { thinkingBudget: 0 } }
            : {}),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Gemini error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMsg = `Gemini error (${response.status}): ${errorJson.error.message}`;
        }
      } catch {
        errorMsg = `Gemini error (${response.status}): ${errorText.slice(0, 300)}`;
      }
      const sanitized = redactSecrets(errorMsg, [cleanKey]);
      throw new Error(sanitized);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      if (data.promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked request: ${data.promptFeedback.blockReason}`);
      }
      return '';
    }

    const parts = data.candidates[0]?.content?.parts || [];
    // Prioritize non-thought text parts (Gemini 2.5 thinking models output {thought: true} before text)
    const textPart = parts.find((p: any) => !p.thought && typeof p.text === 'string');
    return (textPart?.text || parts[0]?.text || '').trim();
  } catch (err: any) {
    throw new Error(redactSecrets(err.message, [cleanKey]));
  }
}

export async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('OpenAI API key is not configured. Please set your key in Options.');
  }

  const modelName = (model || 'gpt-4o-mini').trim();
  const url = 'https://api.openai.com/v1/chat/completions';

  const isReasoning = /^o[134](-|$)/i.test(modelName);
  const maxTokens = options?.maxTokens ?? 1000;

  const requestBody: Record<string, any> = {
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  if (isReasoning) {
    // OpenAI reasoning models (o1, o3-mini) do not accept temperature and require max_completion_tokens
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.temperature = 0.4;
    requestBody.max_tokens = maxTokens;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `OpenAI error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMsg = `OpenAI error (${response.status}): ${errorJson.error.message}`;
        }
      } catch {
        errorMsg = `OpenAI error (${response.status}): ${errorText.slice(0, 300)}`;
      }
      const sanitized = redactSecrets(errorMsg, [cleanKey]);
      throw new Error(sanitized);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (err: any) {
    throw new Error(redactSecrets(err.message, [cleanKey]));
  }
}

export async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Anthropic API key is not configured. Please set your key in Options.');
  }

  const modelName = (model || 'claude-3-5-haiku-20241022').trim();
  const url = 'https://api.anthropic.com/v1/messages';
  const maxTokens = options?.maxTokens ?? 1000;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'dangerously-allow-browser': 'true',
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: modelName,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Anthropic error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMsg = `Anthropic error (${response.status}): ${errorJson.error.message}`;
        }
      } catch {
        errorMsg = `Anthropic error (${response.status}): ${errorText.slice(0, 300)}`;
      }
      const sanitized = redactSecrets(errorMsg, [cleanKey]);
      throw new Error(`Anthropic error (${response.status}): ${sanitized}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text?.trim() || '';
  } catch (err: any) {
    throw new Error(redactSecrets(err.message, [cleanKey]));
  }
}
