import 'server-only';
import { env } from '../env';
import { logger } from '../logger';
import {
  buildRefinementPrompt,
  buildUserPrompt,
  CALORIE_SYSTEM_PROMPT,
  REFINEMENT_SYSTEM_PROMPT,
  RETRY_SUFFIX,
  type RefinementAnswer,
} from './prompt';
import { parseAiResponse, type NormalizedAnalysis } from './schema';
import { AnthropicVisionProvider } from './providers/anthropic';
import { MockVisionProvider } from './providers/mock';
import { OpenAiVisionProvider } from './providers/openai';
import { ProviderError, type VisionProvider } from './providers/types';

let cached: VisionProvider | null = null;

export function getVisionProvider(): VisionProvider {
  if (cached) return cached;

  // Χωρίς API key δεν έχει νόημα να ξεκινήσει πραγματικός πάροχος: πέφτουμε
  // ελεγχόμενα στον mock ώστε η εφαρμογή να παραμένει λειτουργική τοπικά.
  const provider = env.AI_PROVIDER;
  if (provider === 'mock' || !env.AI_API_KEY) {
    if (provider !== 'mock') {
      logger.warn('ai_provider_fallback_to_mock', { requested: provider });
    }
    // ΠΟΤΕ δεν περνάμε το πραγματικό AI_MODEL στον mock: θα καταγραφόταν και θα
    // εμφανιζόταν ως το μοντέλο που "παρήγαγε" την εκτίμηση, δηλαδή η εφαρμογή
    // θα παρουσίαζε κατασκευασμένα δεδομένα ως πραγματική ανάλυση.
    cached = new MockVisionProvider();
    return cached;
  }

  if (provider === 'gemini') {
    // Το Google AI Studio εκθέτει OpenAI-compatible endpoint κάτω από /openai.
    // Το προσθέτουμε αν λείπει, ώστε ένα base URL χωρίς αυτό να μη σκάει σε 404.
    const base = env.AI_API_BASE_URL.replace(/\/+$/, '');
    const openAiCompatibleBase = base.endsWith('/openai') ? base : `${base}/openai`;
    cached = new OpenAiVisionProvider(env.AI_API_KEY, openAiCompatibleBase, env.AI_MODEL);
    return cached;
  }

  cached =
    provider === 'openai'
      ? new OpenAiVisionProvider(env.AI_API_KEY, env.AI_API_BASE_URL, env.AI_MODEL)
      : new AnthropicVisionProvider(env.AI_API_KEY, env.AI_API_BASE_URL, env.AI_MODEL);
  return cached;
}

export type AnalysisOutcome =
  | { status: 'SUCCESS'; analysis: NormalizedAnalysis; model: string; provider: string; requestId: string | null; durationMs: number }
  | { status: 'NO_FOOD_DETECTED'; code: string; model: string; provider: string; requestId: string | null; durationMs: number }
  | { status: 'INVALID_RESPONSE'; reason: string; model: string; provider: string; requestId: string | null; durationMs: number }
  | { status: 'PROVIDER_ERROR' | 'TIMEOUT'; reason: string; model: string; provider: string; requestId: null; durationMs: number };

export interface AnalyzeInput {
  imageBuffer: Buffer;
  mimeType: string;
  userNote?: string | null;
}

/**
 * Καλεί τον πάροχο AI και επιστρέφει *πάντα* ελεγμένο αποτέλεσμα.
 * Σε μη έγκυρο JSON γίνεται ένα ελεγχόμενο retry με αυστηρότερη οδηγία.
 */
export async function analyzeMealImage(input: AnalyzeInput): Promise<AnalysisOutcome> {
  return runVision({
    imageBuffer: input.imageBuffer,
    mimeType: input.mimeType,
    systemPrompt: CALORIE_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(input.userNote),
  });
}

export interface RefineInput {
  imageBuffer: Buffer;
  mimeType: string;
  previous: unknown;
  answers: RefinementAnswer[];
}

/**
 * Δεύτερο πέρασμα με τις απαντήσεις του χρήστη στις διευκρινιστικές ερωτήσεις.
 * Ίδιο συμβόλαιο εξόδου με την αρχική ανάλυση, ώστε ο caller να μη διακρίνει.
 */
export async function refineMealAnalysis(input: RefineInput): Promise<AnalysisOutcome> {
  return runVision({
    imageBuffer: input.imageBuffer,
    mimeType: input.mimeType,
    systemPrompt: REFINEMENT_SYSTEM_PROMPT,
    userPrompt: buildRefinementPrompt(input.previous, input.answers),
  });
}

interface VisionRun {
  imageBuffer: Buffer;
  mimeType: string;
  systemPrompt: string;
  userPrompt: string;
}

/** Έως τόσες συνολικά προσπάθειες όταν ο πάροχος επιστρέφει επαναλήψιμο σφάλμα. */
const MAX_ATTEMPTS = 3;

/**
 * Δεν ξεκινάμε νέα προσπάθεια αν έχουμε ήδη ξοδέψει τόσο χρόνο: αλλιώς
 * διαδοχικά timeouts (AI_TIMEOUT_MS το καθένα) θα ξεπερνούσαν το `maxDuration`
 * του route. Ένα 503 όμως επιστρέφει σε δευτερόλεπτα, οπότε καλύπτεται πλήρως.
 */
const RETRY_TIME_BUDGET_MS = 45_000;

function providerFailure(
  error: unknown,
  providerName: string,
  durationMs: number,
): AnalysisOutcome {
  if (error instanceof ProviderError) {
    // Το `detail` (raw provider error) μένει αποκλειστικά στα server logs.
    logger.error('ai_provider_error', { detail: error.detail, provider: providerName });
    const timedOut = error.detail.startsWith('timeout');
    return {
      status: timedOut ? 'TIMEOUT' : 'PROVIDER_ERROR',
      reason: timedOut ? 'TIMEOUT' : 'PROVIDER_ERROR',
      model: env.AI_MODEL,
      provider: providerName,
      requestId: null,
      durationMs,
    };
  }
  logger.error('ai_unexpected_error', {
    message: error instanceof Error ? error.message : 'unknown',
  });
  return {
    status: 'PROVIDER_ERROR',
    reason: 'UNEXPECTED',
    model: env.AI_MODEL,
    provider: providerName,
    requestId: null,
    durationMs,
  };
}

async function runVision(input: VisionRun): Promise<AnalysisOutcome> {
  const provider = getVisionProvider();
  const imageBase64 = input.imageBuffer.toString('base64');
  const started = Date.now();

  const attempt = async (retry: boolean) =>
    provider.analyze({
      imageBase64,
      mimeType: input.mimeType,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt + (retry ? RETRY_SUFFIX : ''),
      timeoutMs: env.AI_TIMEOUT_MS,
    });

  let lastError: unknown = null;

  for (let n = 1; n <= MAX_ATTEMPTS; n += 1) {
    try {
      let response = await attempt(false);
      let parsed = parseAiResponse(response.text);

      // Ξεχωριστό retry για μη έγκυρο JSON: το μοντέλο απάντησε, αλλά όχι σε
      // σωστή μορφή. Ένα αυστηρότερο prompt συνήθως το διορθώνει.
      if (parsed.kind === 'invalid') {
        logger.warn('ai_invalid_response_retrying', {
          reason: parsed.reason,
          provider: provider.name,
        });
        response = await attempt(true);
        parsed = parseAiResponse(response.text);
      }

      const common = {
        model: response.model,
        provider: provider.name,
        requestId: response.requestId,
        durationMs: Date.now() - started,
      };

      if (parsed.kind === 'ok') return { status: 'SUCCESS', analysis: parsed.data, ...common };
      if (parsed.kind === 'no_food') return { status: 'NO_FOOD_DETECTED', code: parsed.code, ...common };
      logger.warn('ai_invalid_response_final', { reason: parsed.reason, provider: provider.name });
      return { status: 'INVALID_RESPONSE', reason: parsed.reason, ...common };
    } catch (error) {
      lastError = error;

      // Επαναλήψιμο σφάλμα παρόχου (503 υπερφόρτωση, 429, δικτυακό, timeout):
      // το δωρεάν Gemini πέφτει συχνά σε στιγμιαία υπερφόρτωση που περνά σε
      // δευτερόλεπτα. Χωρίς retry, μια στιγμιαία αστοχία γινόταν μόνιμη
      // αποτυχία και ο χρήστης έβλεπε «δεν καταχωρίστηκε εκτίμηση».
      const retryable = error instanceof ProviderError && error.retryable;
      const withinBudget = Date.now() - started < RETRY_TIME_BUDGET_MS;

      if (retryable && withinBudget && n < MAX_ATTEMPTS) {
        const backoffMs = 500 * n; // 500ms, 1000ms
        logger.warn('ai_provider_retrying', {
          attempt: n,
          provider: provider.name,
          detail: error instanceof ProviderError ? error.detail : 'unknown',
        });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      return providerFailure(error, provider.name, Date.now() - started);
    }
  }

  // Θεωρητικά μη προσβάσιμο (το loop επιστρέφει πάντα), αλλά ο τύπος το απαιτεί.
  return providerFailure(lastError, provider.name, Date.now() - started);
}

/** Μόνο για tests: επιτρέπει επαναρχικοποίηση του cached provider. */
export function __resetVisionProvider(): void {
  cached = null;
}

export type { NormalizedAnalysis } from './schema';
