import { withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getFavoriteThumb } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** Οι εικόνες αγαπημένων ελέγχουν ιδιοκτησία σε κάθε αίτημα (anti-IDOR). */
export const GET = withErrorHandling(async (_req: Request, { params }: Context) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { body, contentType } = await getFavoriteThumb(user.id, id);
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(body.byteLength),
      'cache-control': 'private, max-age=3600, must-revalidate',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    },
  });
});
