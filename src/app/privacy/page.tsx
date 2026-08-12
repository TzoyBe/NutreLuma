import type { Metadata } from 'next';
import Link from 'next/link';
import { Disclaimer } from '@/components/ui/misc';
import { JOYBEE } from '@/components/brand/joybee';
import { SiteFooter } from '@/components/site-footer';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('privacy.title') };
}

const SECTION_KEYS = [1, 2, 3, 4, 5, 6] as const;

export default async function PrivacyPage() {
  const t = await getT();
  const sections = SECTION_KEYS.map((n) => ({
    title: t(`privacy.s${n}Title` as never),
    body: t(`privacy.s${n}Body` as never),
  }));

  return (
    <main id="main" className="container max-w-2xl space-y-6 py-10">
      <div>
        <Link href="/" className="text-sm text-primary underline underline-offset-4">
          ← {t('app.name')}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{t('privacy.title')}</h1>
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.title} className="space-y-1">
            <h2 className="font-semibold">{section.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm leading-relaxed text-muted-foreground">
        {t('app.productOf')} {JOYBEE.copyright}.
      </div>

      <Disclaimer text={t('app.disclaimer')} />

      <SiteFooter labels={{ partOf: t('app.partOf'), productOf: t('app.productOf') }} />
    </main>
  );
}
