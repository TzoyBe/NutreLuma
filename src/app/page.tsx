import Link from 'next/link';
import { BarChart3, Camera, ShieldCheck } from 'lucide-react';
import { Disclaimer } from '@/components/ui/misc';
import { Logo } from '@/components/brand/logo';
import { getT } from '@/i18n/locale';

export default async function LandingPage() {
  const t = await getT();
  const features = [
    { Icon: Camera, title: t('landing.feature1Title'), body: t('landing.feature1Body') },
    { Icon: BarChart3, title: t('landing.feature2Title'), body: t('landing.feature2Body') },
    { Icon: ShieldCheck, title: t('landing.feature3Title'), body: t('landing.feature3Body') },
  ];

  return (
    <div className="min-h-dvh">
      <header className="pointer-events-none sticky top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="container px-0">
          <div className="liquid-top-nav pointer-events-auto flex min-h-16 items-center justify-between gap-3 px-3 py-2">
        <Logo />
        <nav className="flex items-center gap-2" aria-label={t('nav.menu')}>
          <Link
            href="/login"
            className="liquid-nav-link rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {t('nav.login')}
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_1px_0_hsl(var(--glass-border)/0.42)_inset,0_12px_26px_-14px_hsl(var(--primary)/0.95)] hover:bg-primary/90"
          >
            {t('nav.register')}
          </Link>
        </nav>
          </div>
        </div>
      </header>

      <main id="main" className="container space-y-14 pb-16 pt-8">
        <section className="mx-auto max-w-2xl space-y-5 text-center">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">{t('landing.heroSubtitle')}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 font-medium text-primary-foreground shadow-[0_10px_28px_-10px_hsl(var(--primary)/0.95)] transition-transform active:scale-[0.97] hover:bg-primary/90"
            >
              {t('landing.ctaPrimary')}
            </Link>
            <Link
              href="/login"
              className="liquid-control inline-flex h-12 items-center justify-center rounded-full px-7 font-semibold transition-transform active:scale-[0.97]"
            >
              {t('landing.ctaSecondary')}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {features.map(({ Icon, title, body }) => (
            <article key={title} className="glass glass-specular rounded-[--radius] p-5">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto max-w-2xl">
          <Disclaimer text={t('app.disclaimer')} />
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} {t('app.name')}</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/terms" className="underline underline-offset-4">
              {t('terms.navLabel')}
            </Link>
            <Link href="/privacy" className="underline underline-offset-4">
              {t('nav.privacy')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
