import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/toast';

// Joybee brand fonts. Inter καλύπτει και ελληνικά· η Sora (headings) δεν έχει
// greek subset, οπότε τα ελληνικά headings κάνουν per-glyph fallback στο Inter.
const inter = Inter({ subsets: ['latin', 'greek'], variable: '--font-inter', display: 'swap' });
const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});
import { localeTag, t } from '@/i18n';
import { LocaleProvider } from '@/i18n/client';
import { getLocale, getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = `${t('app.name')} — ${t('app.tagline')}`;
  const description = t('landing.heroSubtitle');
  return {
    metadataBase: new URL('https://nutreluma.com'),
    title: {
      default: title,
      template: `%s · ${t('app.name')}`,
    },
    description,
    robots: { index: false, follow: false },
    applicationName: t('app.name'),
    openGraph: {
      title,
      description,
      siteName: t('app.name'),
      type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: t('app.name') }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og.png'],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A1E22',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Η γλώσσα διαβάζεται ΜΙΑ φορά εδώ και δίνεται στον client μέσω context, ώστε
  // server και client render να συμφωνούν και να μη γίνεται flash λάθος γλώσσας.
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <body>
        <a href="#main" className="sr-only sr-only-focusable">
          {t('common.skipToContent', locale)}
        </a>
        <LocaleProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
        <span className="sr-only" data-locale={localeTag(locale)} />
      </body>
    </html>
  );
}
