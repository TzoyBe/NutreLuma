import { NextResponse, type NextRequest } from 'next/server';

/**
 * Κάθε σελίδα πίσω από σύνδεση. Το `/profile` καλύπτει και τα υπο-μενού του
 * (βάρος, συνδρομή). Τα παλιά μονοπάτια μένουν γιατί εξακολουθούν να
 * υπάρχουν ως ανακατευθύνσεις.
 */
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

/**
 * Σελίδες που δεν έχουν νόημα για συνδεδεμένο χρήστη.
 *
 * Το `/reset-password` ΔΕΝ μπαίνει εδώ επίτηδες: κάποιος που υποπτεύεται
 * παραβίαση πρέπει να μπορεί να ολοκληρώσει την επαναφορά ακόμη κι αν υπάρχει
 * ενεργή συνεδρία στον browser.
 */
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

/**
 * Γρήγορος έλεγχος παρουσίας session cookie για τα navigations.
 * Η πραγματική επαλήθευση (υπογραφή + ύπαρξη χρήστη) γίνεται πάντα server-side
 * στα `requirePageUser` / `requireApiUser`.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    Boolean(request.cookies.get('cv_session')?.value) ||
    Boolean(request.cookies.get('__Host-cv_session')?.value);

  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
