import type { MetadataRoute } from 'next';

/** PWA manifest — τα icons ζουν στο public/icons (από το brand kit). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NutreLuma',
    short_name: 'NutreLuma',
    description: 'See your food differently.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0B1220',
    theme_color: '#0A1E22',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
