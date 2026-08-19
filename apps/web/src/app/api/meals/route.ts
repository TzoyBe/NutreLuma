import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { getUserTimezone } from '@/server/services/profile';
import { createManualMeal, createMealWithAnalysis, listMealHistory } from '@/server/services/meal';
import { createMealSchema, manualMealSchema, mealHistoryQuerySchema } from '@/lib/validation/meal';
import { maxUploadBytes } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Η ανάλυση είναι σύγχρονη στο MVP· δίνουμε χρόνο στον πάροχο AI.
export const maxDuration = 120;

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const query = mealHistoryQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  const timezone = await getUserTimezone(user.id);
  const result = await listMealHistory(user.id, query, timezone);
  return jsonOk(result);
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);

  const contentType = request.headers.get('content-type') ?? '';

  // Χειροκίνητη καταχώριση: JSON χωρίς φωτογραφία, καμία κλήση στο AI.
  // Το endpoint παραμένει το ίδιο ώστε να μη σπάσει κανένας υπάρχων client.
  if (contentType.includes('application/json')) {
    const input = manualMealSchema.parse(await request.json());
    const timezone = await getUserTimezone(user.id);
    const { meal, duplicated } = await createManualMeal({ userId: user.id, input, timezone });
    return jsonOk({ meal, duplicated }, duplicated ? 200 : 201);
  }

  if (!contentType.includes('multipart/form-data')) {
    throw new ApiError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Απαιτείται multipart/form-data (με φωτογραφία) ή application/json (χειροκίνητη καταχώριση).',
    );
  }

  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) {
    throw new ApiError('BAD_REQUEST', 'Δεν στάλθηκε φωτογραφία.');
  }
  if (file.size > maxUploadBytes) {
    throw new ApiError(
      'PAYLOAD_TOO_LARGE',
      `Το αρχείο ξεπερνά το όριο των ${Math.round(maxUploadBytes / (1024 * 1024))} MB.`,
    );
  }

  const input = createMealSchema.parse({
    mealType: form.get('mealType') ?? undefined,
    mealDateTime: form.get('mealDateTime') ?? undefined,
    notes: form.get('notes')?.toString() || undefined,
    title: form.get('title')?.toString() || undefined,
    requestKey: form.get('requestKey')?.toString() || undefined,
  });

  const timezone = await getUserTimezone(user.id);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { meal, duplicated } = await createMealWithAnalysis({
    userId: user.id,
    file: buffer,
    input,
    timezone,
  });

  return jsonOk({ meal, duplicated }, duplicated ? 200 : 201);
});
