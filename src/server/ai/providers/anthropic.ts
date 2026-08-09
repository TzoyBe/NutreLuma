import 'server-only';
import {
  fetchWithTimeout,
  ProviderError,
  type VisionProvider,
  type VisionRequest,
  type VisionResponse,
  type TextRequest,
} from './types';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  id?: string;
  model?: string;
  content?: AnthropicContentBlock[];
}

/** Adapter για το Anthropic Messages API (multimodal). */
export class AnthropicVisionProvider implements VisionProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {
    if (!apiKey) {
      throw new ProviderError('AI not configured', 'missing AI_API_KEY for anthropic provider');
    }
  }

  async analyze(request: VisionRequest): Promise<VisionResponse> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/v1/messages`;
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          temperature: 0,
          system: request.systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: request.mimeType,
                    data: request.imageBase64,
                  },
                },
                { type: 'text', text: request.userPrompt },
              ],
            },
          ],
        }),
      },
      request.timeoutMs,
    );

    const requestId = response.headers.get('request-id');

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ProviderError(
        'AI provider error',
        `status=${response.status} body=${body.slice(0, 300)}`,
        response.status >= 500 || response.status === 429,
      );
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = (data.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n')
      .trim();

    if (!text) {
      throw new ProviderError('AI empty response', 'no text block in response', true);
    }

    return { text, model: data.model ?? this.model, requestId: requestId ?? data.id ?? null };
  }

  async generateText(request: TextRequest): Promise<VisionResponse> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/v1/messages`;
    const response = await fetchWithTimeout(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: this.model, max_tokens: 8000, temperature: 0.2, system: request.systemPrompt, messages: [{ role: 'user', content: request.userPrompt }] }) }, request.timeoutMs);
    const requestId = response.headers.get('request-id');
    if (!response.ok) throw new ProviderError('AI provider error', `status=${response.status}`, response.status >= 500 || response.status === 429);
    const data = (await response.json()) as AnthropicResponse;
    const text = (data.content ?? []).filter((block) => block.type === 'text' && typeof block.text === 'string').map((block) => block.text as string).join('\n').trim();
    if (!text) throw new ProviderError('AI empty response', 'no text content', true);
    return { text, model: data.model ?? this.model, requestId: requestId ?? data.id ?? null };
  }
}
