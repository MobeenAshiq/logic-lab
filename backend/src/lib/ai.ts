export type AiMessage = { role: 'user' | 'assistant'; content: string };

export interface AskAiInput {
  system: string;
  messages: AiMessage[];
}

/** Server-only provider adapter. Provider credentials are read only from backend env. */
export async function askAI({ system, messages }: AskAiInput): Promise<string> {
  const provider = process.env.AI_PROVIDER ?? 'gemini';
  const model = process.env.AI_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    if (provider === 'groq') {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error('AI provider is not configured.');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model ?? 'llama-3.1-8b-instant',
          messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`AI provider request failed (${response.status}).`);
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('AI provider returned an empty response.');
      return content;
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('AI provider is not configured.');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model ?? 'gemini-2.0-flash')}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`AI provider request failed (${response.status}).`);
    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!content) throw new Error('AI provider returned an empty response.');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
