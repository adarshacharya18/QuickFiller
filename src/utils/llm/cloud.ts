import { redactSecrets } from '../security';

export async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Gemini API key is not configured. Please set your key in Options.');
  }

  const modelName = model || 'gemini-1.5-flash';
  // Prefer x-goog-api-key header to avoid leaking secrets in URL query strings
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
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
          maxOutputTokens: 1000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const sanitized = redactSecrets(errorText, [cleanKey]);
      throw new Error(`Gemini error (${response.status}): ${sanitized}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } catch (err: any) {
    throw new Error(redactSecrets(err.message, [cleanKey]));
  }
}

export async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('OpenAI API key is not configured. Please set your key in Options.');
  }

  const modelName = model || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const sanitized = redactSecrets(errorText, [cleanKey]);
      throw new Error(`OpenAI error (${response.status}): ${sanitized}`);
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
  userPrompt: string
): Promise<string> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Anthropic API key is not configured. Please set your key in Options.');
  }

  const modelName = model || 'claude-3-5-haiku-20241022';
  const url = 'https://api.anthropic.com/v1/messages';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: modelName,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 1000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const sanitized = redactSecrets(errorText, [cleanKey]);
      throw new Error(`Anthropic error (${response.status}): ${sanitized}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text?.trim() || '';
  } catch (err: any) {
    throw new Error(redactSecrets(err.message, [cleanKey]));
  }
}
