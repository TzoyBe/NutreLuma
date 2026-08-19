import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/meals',
  '/history',
  '/stats',
  '/goals',
  '/profile',
  '/weight',
  '/billing',
  '/settings',
  '/admin',
  '/onboarding',
];

const AUTH_PAGES = ['/login', '/register', '/forgot-password'];
const PAYPAL_ORIGINS = ['https://www.paypal.com', 'https://www.sandbox.paypal.com'];
const PAYPAL_ASSETS = 'https://www.paypalobjects.com';

function buildCsp(nonce: string, isProd: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isProd ? '' : " 'unsafe-eval'"} ${PAYPAL_ORIGINS.join(' ')} ${PAYPAL_ASSETS}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${PAYPAL_ASSETS} ${PAYPAL_ORIGINS.join(' ')}`,
    "font-src 'self' data:",
    `connect-src 'self' ${PAYPAL_ORIGINS.join(' ')} ${PAYPAL_ASSETS}`,
    `frame-src ${PAYPAL_ORIGINS.join(' ')}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function applySecurityHeaders(
  response: NextResponse,
  requestHeaders: Headers,
  nonce: string,
  isProd: boolean,
) {
  const csp = buildCsp(nonce, isProd);

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  );
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    Boolean(request.cookies.get('cv_session')?.value) ||
    Boolean(request.cookies.get('__Host-cv_session')?.value);
  const requestHeaders = new Headers(request.headers);
  const nonce = btoa(crypto.randomUUID());
  const isProd = process.env.NODE_ENV === 'production';

  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    const response = NextResponse.redirect(url);
    applySecurityHeaders(response, requestHeaders, nonce, isProd);
    return response;
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    const response = NextResponse.redirect(url);
    applySecurityHeaders(response, requestHeaders, nonce, isProd);
    return response;
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applySecurityHeaders(response, requestHeaders, nonce, isProd);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
