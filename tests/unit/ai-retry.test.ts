import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ρυθμίζουμε πραγματικό OpenAI-compatible provider ΠΡΙΝ το import, ώστε το
// getVisionProvider να μη πέσει στον mock (που δεν αποτυγχάνει ποτέ).
process.env.AI_PROVIDER = 'openai';
process.env.AI_API_KEY = 'test-key';
process.env.AI_API_BASE_URL = 'https://api.test/v1';
process.env.AI_MODEL = 'test-model';
process.env.AI_TIMEOUT_MS = '5000';

const { analyzeMealImage, __resetVisionProvider } = await import('@/server/ai');

const VALID_CONTENT = JSON.stringify({
  mostLikelyCalories: 500,
  confidence: 0.8,
  items: [{ name: 'rice', estimatedQuantity: '200 g', estimatedCalories: 500 }],
});

const okResponse = () =>
  new Response(
    JSON.stringify({ model: 'test-model', choices: [{ message: { content: VALID_CONTENT } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const overloaded = () =>
  new Response(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE' } }), { status: 503 });

const badRequest = () =>
  new Response(JSON.stringify({ error: { code: 400 } }), { status: 400 });

const input = () => ({ imageBuffer: Buffer.from('img'), mimeType: 'image/webp' as const });

beforeEach(() => __resetVisionProvider());
afterEach(() => vi.unstubAllGlobals());

describe('AI retry σε στιγμιαία υπερφόρτωση παρόχου', () => {
  it('ένα 503 μετά επιτυχία -> SUCCESS (το γεύμα ΔΕΝ αποτυγχάνει)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(overloaded())
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await analyzeMealImage(input());

    expect(outcome.status).toBe('SUCCESS');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('δύο 503 μετά επιτυχία -> SUCCESS (3 προσπάθειες συνολικά)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(overloaded())
      .mockResolvedValueOnce(overloaded())
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await analyzeMealImage(input());

    expect(outcome.status).toBe('SUCCESS');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('συνεχή 503 -> εξαντλεί τις προσπάθειες και επιστρέφει PROVIDER_ERROR', async () => {
    const fetchMock = vi.fn().mockResolvedValue(overloaded());
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await analyzeMealImage(input());

    expect(outcome.status).toBe('PROVIDER_ERROR');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('ΔΕΝ κάνει retry σε μη επαναλήψιμο σφάλμα (400)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(badRequest());
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await analyzeMealImage(input());

    expect(outcome.status).toBe('PROVIDER_ERROR');
    // Μία μόνο κλήση: το 400 δεν είναι επαναλήψιμο.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
