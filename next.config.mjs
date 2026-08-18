/** @type {import('next').NextConfig} */
/**
 * Συντηρητικό CSP: περιορίζει ΜΟΝΟ τα υψηλού κινδύνου διανύσματα που το app δεν
 * χρησιμοποιεί (base-tag injection, plugins, framing). ΔΕΝ ορίζουμε
 * script-src/default-src ώστε να μη σπάσει το inline hydration script του
 * Next.js ή τα inline styles — αυτό θα απαιτούσε nonce-based CSP.
 *  - base-uri 'self'      → αποτρέπει <base> hijack για κλοπή relative URLs
 *  - object-src 'none'    → κανένα legacy plugin/embed
 *  - frame-ancestors 'none' → σύγχρονο ισοδύναμο του X-Frame-Options: DENY
 */
const contentSecurityPolicy = "base-uri 'self'; object-src 'none'; frame-ancestors 'none'";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['sharp', '@prisma/client', 'bcryptjs'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
