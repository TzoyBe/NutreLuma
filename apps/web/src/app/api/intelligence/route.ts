import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { env } from '@/server/env';
import {
  getCorrectionRates,
  getIntelligenceSettings,
  getPersonalCalibration,
  resetPersonalCalibration,
  updateIntelligenceSettings,
} from '@/server/services/personal-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  if (!env.PERSONAL_CALIBRATION) return jsonOk({ enabled: false });
  const [calibration, correctionRates, settings] = await Promise.all([
    getPersonalCalibration(user.id),
    getCorrectionRates(user.id),
    getIntelligenceSettings(user.id),
  ]);
  return jsonOk({ enabled: true, calibration, correctionRates, settings });
});

export const PUT = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const body = await request.json().catch(() => ({}));
  const allowed = ['personalCalibration', 'useMealHistory', 'useWeightHistory', 'useBehaviorPatterns'] as const;
  const data = Object.fromEntries(allowed.filter((key) => typeof body?.[key] === 'boolean').map((key) => [key, body[key]]));
  return jsonOk({ settings: await updateIntelligenceSettings(user.id, data) });
});

export const DELETE = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await resetPersonalCalibration(user.id);
  return jsonOk({ reset: true });
});
