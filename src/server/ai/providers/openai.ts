import 'server-only';
import {
  fetchWithTimeout,
  ProviderError,
  type VisionProvider,
  type VisionRequest,
  type VisionResponse,
  type TextRequest,
} from './types';

interface OpenAiResponse {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
}

/**
 * Adapter για οποιοδήποτε OpenAI-compatible chat completions endpoint
 * (OpenAI, OpenRouter, LM Studio, vLLM κ.λπ.) με υποστήριξη εικόνας.
 */
export class OpenAiVisionProvider implements VisionProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {
    if (!apiKey) {
      throw new ProviderError('AI not configured', 'missing AI_API_KEY for openai provider');
    }
  }

  async analyze(request: VisionRequest): Promise<VisionResponse> {
    const base = this.baseUrl.replace(/\/+$/, '');
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          // Τα thinking models (π.χ. Gemini Flash) καταναλώνουν μέρος του budget
          // σε εσωτερική σκέψη. Με μικρό όριο το JSON κόβεται στη μέση, το
          // parsing αποτυγχάνει και ενεργοποιείται περιττό retry.
          max_tokens: 4096,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: request.userPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${request.mimeType};base64,${request.imageBase64}`,
                    detail: 'low',
                  },
                },
              ],
            },
          ],
        }),
      },
      request.timeoutMs,
    );

    const requestId = response.headers.get('x-request-id');

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ProviderError(
        'AI provider error',
        `status=${response.status} body=${body.slice(0, 300)}`,
        response.status >= 500 || response.status === 429,
      );
    }

    const data = (await response.json()) as OpenAiResponse;
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new ProviderError('AI empty response', 'no content in first choice', true);
    }

    return { text, model: data.model ?? this.model, requestId: requestId ?? data.id ?? null };
  }

  async generateText(request: TextRequest): Promise<VisionResponse> {
    const base = this.baseUrl.replace(/\/+$/, '');
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    const response = await fetchWithTimeout(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, temperature: 0.7, max_tokens: 8000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: request.systemPrompt }, { role: 'user', content: request.userPrompt }] }) }, request.timeoutMs);
    const requestId = response.headers.get('x-request-id');
    if (!response.ok) throw new ProviderError('AI provider error', `status=${response.status}`, response.status >= 500 || response.status === 429);
    const data = (await response.json()) as OpenAiResponse;
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new ProviderError('AI empty response', 'no text content', true);
    return { text, model: data.model ?? this.model, requestId: requestId ?? data.id ?? null };
  }
}
