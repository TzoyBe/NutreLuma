export interface VisionRequest {
  imageBase64: string;
  mimeType: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
}

export interface VisionResponse {
  /** Το raw κείμενο της απάντησης — δεν φτάνει ποτέ αυτούσιο στον χρήστη. */
  text: string;
  model: string;
  requestId: string | null;
}

export interface VisionProvider {
  readonly name: string;
  analyze(request: VisionRequest): Promise<VisionResponse>;
  generateText?(request: TextRequest): Promise<VisionResponse>;
}

export interface TextRequest {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
}

/** Σφάλμα επιπέδου παρόχου. Το `detail` μένει μόνο στα server logs. */
export class ProviderError extends Error {
  readonly detail: string;
  readonly retryable: boolean;

  constructor(message: string, detail: string, retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.detail = detail;
    this.retryable = retryable;
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderError('AI timeout', `timeout after ${timeoutMs}ms`, true);
    }
    throw new ProviderError(
      'AI network error',
      error instanceof Error ? error.message : 'unknown',
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}
