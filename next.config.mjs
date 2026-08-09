/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// Το Next χρειάζεται inline scripts για το hydration payload και inline styles για
// τα critical CSS chunks.
//
// Τα μόνα εξωτερικά origins που επιτρέπονται είναι της PayPal, και μόνο στις
// οδηγίες που χρειάζεται πραγματικά το JS SDK του: κατεβάζει script, ανοίγει
// iframe/popup για την έγκριση, καλεί τα δικά του API και φορτώνει εικονίδια.
// Το `default-src` παραμένει 'self' — τίποτε άλλο δεν διευρύνεται.
const paypal = ['https://www.paypal.com', 'https://www.sandbox.paypal.com'];
const paypalAssets = 'https://www.paypalobjects.com';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} ${paypal.join(' ')} ${paypalAssets}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${paypalAssets} ${paypal.join(' ')}`,
  "font-src 'self' data:",
  `connect-src 'self' ${paypal.join(' ')} ${paypalAssets}`,
  `frame-src ${paypal.join(' ')}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Αφορά το να ΜΑΣ βάλει κάποιος σε iframe — δεν επηρεάζεται από τα παραπάνω.
  "frame-ancestors 'none'",
  // ΔΕΝ χρησιμοποιούμε "upgrade-insecure-requests": τα headers ψήνονται στο
  // build, οπότε η οδηγία θα ίσχυε και σε deployment πάνω από plain http (π.χ.
  // τοπικό δίκτυο) — εκεί ο browser θα ζητούσε τα /_next assets μέσω https και
  // θα απέτυχαν όλα (άστυλη, μη διαδραστική σελίδα).
  // Όλα τα resources είναι same-origin και σχετικά, άρα σε https deployment
  // φορτώνονται ήδη μέσω https· την επιβολή https την αναλαμβάνει το HSTS.
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig = {
  // Δεν χρησιμοποιούμε "standalone": ο runtime container κρατά ολόκληρο το
  // node_modules ώστε να είναι διαθέσιμο και το prisma CLI για τα migrations.
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['sharp', '@prisma/client', 'bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
