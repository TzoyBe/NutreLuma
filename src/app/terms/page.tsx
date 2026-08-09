import type { Metadata } from 'next';
import Link from 'next/link';
import { Disclaimer } from '@/components/ui/misc';
import { Logo } from '@/components/brand/logo';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('terms.title') };
}

/** 20 ενότητες, με ζεύγη κλειδιών sNTitle / sNBody στα λεξικά. */
const SECTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export default async function TermsPage() {
  const t = await getT();

  return (
    <main id="main" className="container max-w-2xl space-y-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-primary underline underline-offset-4">
          <Logo markClassName="h-6 w-6" className="text-sm" />
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('terms.title')}</h1>
        <p className="text-xs text-muted-foreground">{t('terms.lastUpdated')}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('terms.intro')}</p>
      </div>

      <div className="space-y-5">
        {SECTIONS.map((n) => (
          <section key={n} className="space-y-1">
            <h2 className="font-semibold">{t(`terms.s${n}Title` as never)}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(`terms.s${n}Body` as never)}
            </p>
          </section>
        ))}
      </div>

      <Disclaimer text={t('app.disclaimer')} />

      <p className="text-sm">
        <Link href="/privacy" className="text-primary underline underline-offset-4">
          {t('privacy.title')}
        </Link>
      </p>
    </main>
  );
}
