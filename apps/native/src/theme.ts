// Brand kit v2 tokens (Nutreluma). Πηγή: nutreluma_brand_kit/09_Design_Tokens.
export const colors = {
  background: '#0B1020', // navy
  navy2: '#11182E',
  surface: '#151D35',
  surfaceSoft: '#1A2442', // surface_2
  border: 'rgba(191, 210, 248, 0.24)',
  borderStrong: 'rgba(191, 210, 248, 0.42)',
  primary: '#2563EB', // main action / product intelligence
  primarySoft: 'rgba(37, 99, 235, 0.16)',
  blueBright: '#3B6FF5', // calories / intelligence highlight
  accent: '#FFB703', // gold — accent, not a general CTA
  accentSoft: 'rgba(255, 183, 3, 0.14)',
  goldSoft: '#D8AA48',
  // Personalization / premium / selected states (brand purple & violet).
  purple: '#7C3AED',
  purpleSoft: 'rgba(124, 58, 237, 0.16)',
  violet: '#6746E8',
  cyan: '#2DD4BF',
  text: '#F3F4F6', // light
  muted: '#AAB3C5',
  mutedSoft: '#7D88A5',
  danger: '#EF4444',
  success: '#10B981', // teal — positive health/status
  white: '#FFFFFF',
  // Liquid glass tokens: ημιδιαφανείς επιφάνειες πάνω από το gradient backdrop,
  // με λεπτό φωτεινό περίγραμμα — ίδιο ύφος με τις .glass κλάσεις του web.
  glassBg: 'rgba(26, 36, 66, 0.55)', // surface_2 @ 55%
  glassBgSoft: 'rgba(26, 36, 66, 0.38)',
  glassBorder: 'rgba(191, 210, 248, 0.22)',
  glassHighlight: 'rgba(191, 210, 248, 0.10)',
} as const;

/** Signature gradient (gold→blue→violet) — reserve for logo/premium/achievement. */
export const signatureGradient = ['#FFB703', '#2563EB', '#7C3AED'] as const;

export const API_BASE_URL = 'https://www.nutreluma.com';
