import { z } from 'zod';
import { ApiError, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import {
  isValidExpoPushToken,
  registerPushToken,
  unregisterPushToken,
} from '@/server/services/push-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().trim().min(20).max(200),
  platform: z.string().trim().max(30).optional(),
  deviceName: z.string().trim().max(120).optional(),
});

export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const input = bodySchema.parse(await request.json());
  if (!isValidExpoPushToken(input.token)) {
    throw new ApiError('VALIDATION_ERROR', 'Invalid Expo push token.');
  }
  return jsonOk(await registerPushToken(user.id, input), 201);
});

export const DELETE = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const input = bodySchema.pick({ token: true }).parse(await request.json());
  return jsonOk(await unregisterPushToken(user.id, input.token));
});
