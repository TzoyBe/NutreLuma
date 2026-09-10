import 'server-only';

function requestedOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host') || url.host;
  const protocol = forwardedProto || url.protocol.replace(':', '');
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

export function resolveGoogleOauthOrigin(
  request: Request,
  configuredAppUrl: string,
  production: boolean,
): string {
  return production ? configuredAppUrl.replace(/\/+$/, '') : requestedOrigin(request);
}
