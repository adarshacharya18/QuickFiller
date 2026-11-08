export async function fetchOllamaModels(host: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    const res = await fetch(`${host.replace(/\/+$/, '')}/api/tags`);
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Ollama returned 403 Forbidden (Origin blocked by Ollama CORS policy)');
      }
      throw new Error(`Ollama returned status ${res.status}`);
    }
    const data = await res.json();
    if (data && Array.isArray(data.models)) {
      return data.models.map((m: { name: string }) => m.name);
    }
    return [];
  } catch (error: any) {
    console.warn('Could not fetch models from Ollama:', error);
    if (error instanceof TypeError || error?.message?.includes('Failed to fetch')) {
      throw new Error(
        `Could not connect to Ollama at ${host}. Please ensure Ollama is installed and running ('ollama serve'). If running on a custom port or remote host, check QuickFiller Settings.`
      );
    }
    throw error;
  }
}

export async function callOllama(
  host: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const url = `${host.replace(/\/+$/, '')}/api/chat`;
  let response: Response;
  const requestBody: Record<string, any> = {
    model: model || 'llama3.2:3b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: false,
  };
  if (options?.maxTokens) {
    requestBody.options = { num_predict: options.maxTokens };
  }

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(requestBody),
    });
  } catch (err: any) {
    if (err instanceof TypeError || err?.message?.includes('Failed to fetch')) {
      throw new Error(
        `Could not connect to Ollama at ${host}. Please ensure Ollama is running ('ollama serve') and accessible.`
      );
    }
    throw err;
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403) {
      throw new Error(
        `Ollama returned 403 Forbidden (CORS / Origin blocked). QuickFiller includes automatic Declarative Net Request rules to rewrite origins, but if running Ollama as a service, ensure OLLAMA_ORIGINS="*" is allowed.`
      );
    }
    throw new Error(`Ollama error (${response.status}): ${errorText || response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content?.trim() || '';
}
