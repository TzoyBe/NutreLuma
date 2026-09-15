// Liquid Glass brand kit tokens (Nutreluma). Πηγή: NutreLuma_Liquid_Glass_Brand_Kit.
export const colors = {
  background: '#091631', // Midnight Navy
  navy2: '#0D1D40',
  surface: '#111F42',
  surfaceSoft: '#16274E', // surface_2
  border: 'rgba(191, 210, 248, 0.24)',
  borderStrong: 'rgba(191, 210, 248, 0.42)',
  primary: '#2E63FF', // Electric Blue — main action / product intelligence
  primarySoft: 'rgba(46, 99, 255, 0.16)',
  blueBright: '#4D7CFF', // calories / intelligence highlight
  accent: '#F2C14E', // Solar Gold — accent, not a general CTA
  accentSoft: 'rgba(242, 193, 78, 0.14)',
  goldSoft: '#D8AA48',
  // Personalization / premium / selected states.
  purple: '#8B56FF', // Aurora Violet
  purpleSoft: 'rgba(139, 86, 255, 0.16)',
  violet: '#7A47F0',
  cyan: '#8EDCFF', // Ice Cyan
  text: '#F5F8FF', // Frost White
  muted: '#AAB3C5',
  mutedSoft: '#7D88A5',
  danger: '#EF4444',
  success: '#10B981', // teal — positive health/status
  white: '#FFFFFF',
  // Liquid glass tokens: ημιδιαφανείς επιφάνειες πάνω από το gradient backdrop,
  // με λεπτό φωτεινό περίγραμμα — ίδιο ύφος με τις .glass κλάσεις του web.
  glassBg: 'rgba(22, 39, 78, 0.55)', // surface_2 @ 55%
  glassBgSoft: 'rgba(22, 39, 78, 0.38)',
  glassBorder: 'rgba(191, 210, 248, 0.22)',
  glassHighlight: 'rgba(191, 210, 248, 0.10)',
} as const;

/** Signature gradient (gold→blue→violet) — reserve for logo/premium/achievement. */
export const signatureGradient = ['#F2C14E', '#2E63FF', '#8B56FF'] as const;

export const API_BASE_URL = 'https://www.nutreluma.com';
