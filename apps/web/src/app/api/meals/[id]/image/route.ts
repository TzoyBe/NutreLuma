import { withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getMealImage } from '@/server/services/meal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Οι φωτογραφίες ΔΕΝ σερβίρονται στατικά: κάθε αίτημα ελέγχει ιδιοκτησία.
 * Έτσι δεν υπάρχει public URL που να διαρρέει δεδομένα υγείας.
 */
export const GET = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  const variant = new URL(request.url).searchParams.get('variant') === 'thumb' ? 'thumb' : 'full';

  const { body, contentType } = await getMealImage(user.id, id, variant);

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
