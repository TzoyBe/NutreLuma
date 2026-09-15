import type { MetadataRoute } from 'next';

/** PWA manifest — τα icons ζουν στο public/icons (από το brand kit). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NutreLuma',
    short_name: 'NutreLuma',
    description: 'See your food differently.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#081020',
    theme_color: '#2E63FF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
