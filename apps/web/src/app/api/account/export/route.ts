import { withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { exportToCsv, exportUserData } from '@/server/services/account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json';

  const bundle = await exportUserData(user.id);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    return new Response(exportToCsv(bundle), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="nutreluma-export-${stamp}.csv"`,
        'cache-control': 'no-store',
      },
    });
  }

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="nutreluma-export-${stamp}.json"`,
      'cache-control': 'no-store',
    },
  });
});
