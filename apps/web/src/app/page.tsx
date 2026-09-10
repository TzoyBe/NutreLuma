import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  Target,
} from 'lucide-react';
import { Disclaimer } from '@/components/ui/misc';
import { Logo } from '@/components/brand/logo';
import { JOYBEE, JoybeeAttribution } from '@/components/brand/joybee';
import { LanguageSwitcher } from '@/components/language-switcher';
import { PersonalUniverseConstellation } from '@/components/marketing/personal-universe';
import { getT } from '@/i18n/locale';

const paths = [
  {
    Icon: Camera,
    title: 'Track',
    body: 'Log meals in seconds, then adjust any estimate you know better.',
    color: 'text-emerald-400',
  },
  {
    Icon: Brain,
    title: 'Learn',
    body: 'See the patterns that matter across meals, habits and progress.',
    color: 'text-[hsl(var(--brand-purple))]',
  },
  {
    Icon: Target,
    title: 'Plan',
    body: 'Turn your history into practical guidance shaped around your goals.',
    color: 'text-accent',
  },
] as const;

const proofPoints = [
  { Icon: CheckCircle2, label: 'Estimated', body: 'Clear confidence, always adjustable.' },
  { Icon: Sparkles, label: 'Personal', body: 'Learns from your own corrections.' },
  { Icon: SlidersHorizontal, label: 'In your control', body: 'Goals and targets stay yours.' },
] as const;

export default async function LandingPage() {
  const t = await getT();

  return (
    <div className="universe-page min-h-dvh overflow-hidden">
      <div className="universe-page-glow" aria-hidden="true" />

      <header className="relative z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="container max-w-7xl px-0">
          <div className="liquid-top-nav flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-4">
            <Link href="/" className="liquid-brand -ml-1 px-2 py-1.5" aria-label={t('app.name')}>
              <Logo markClassName="h-9 w-9" className="text-lg" />
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2" aria-label={t('nav.menu')}>
              <div className="mr-2 hidden items-center gap-1 lg:flex">
                <Link href="#how-it-works" className="liquid-nav-link px-4 py-2 text-sm text-muted-foreground hover:text-foreground">How it works</Link>
                <Link href="#personal" className="liquid-nav-link px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Personalization</Link>
              </div>
              <LanguageSwitcher className="mr-0.5 hidden xs:flex" />
              <Link href="/login" className="liquid-nav-link rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground sm:px-4">{t('nav.login')}</Link>
              <Link href="/register" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_1px_0_hsl(var(--glass-border)/0.42)_inset,0_12px_26px_-14px_hsl(var(--primary)/0.95)] hover:bg-primary/90 sm:px-5">{t('nav.register')}</Link>
            </nav>
          </div>
        </div>
      </header>

      <main id="main" className="relative z-10">
        <section className="container grid min-h-[calc(100dvh-5.5rem)] max-w-7xl items-center gap-10 pb-16 pt-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-4 lg:pt-4">
          <div className="relative z-10 max-w-xl py-8 lg:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">A more personal you</p>
            <h1 className="mt-5 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[4.5rem]">
              Built around<br />your patterns.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground sm:text-xl">
              Meals, goals and progress connect into guidance that becomes more personal over time.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-semibold text-primary-foreground shadow-[0_16px_38px_-18px_hsl(var(--primary)/0.98)] transition-transform hover:bg-primary/90 active:scale-[0.97]">
                Build my plan <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="#how-it-works" className="liquid-control inline-flex h-12 items-center justify-center rounded-full px-7 font-semibold transition-transform active:scale-[0.97]">Explore Nutreluma</Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Estimated</span>
              <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-[hsl(var(--brand-purple))]" />Personal</span>
              <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" />Always adjustable</span>
            </div>
          </div>

          <div className="relative mx-auto min-h-[34rem] w-full max-w-[52rem] lg:min-h-[44rem]">
            <PersonalUniverseConstellation />
          </div>
        </section>

        <section id="how-it-works" className="container max-w-7xl pb-8">
          <div className="border-t border-white/10 pt-10">
            <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">How it works</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Everything connects.</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground md:justify-self-end">
                Your nutrition journey flows through three simple paths. Each action gives Nutreluma more useful context for the next one.
              </p>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {paths.map(({ Icon, title, body, color }) => (
                <article key={title} className="glass glass-specular group rounded-[1.6rem] p-5 transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex items-start gap-4">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] ${color}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="personal" className="container max-w-7xl py-16">
          <div className="glass glass-specular grid overflow-hidden rounded-[2rem] p-6 md:grid-cols-[0.9fr_1.1fr] md:p-10">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--brand-purple)/0.25)] bg-[hsl(var(--brand-purple)/0.1)] px-3 py-1 text-xs font-semibold text-[hsl(var(--brand-purple))]">
                <Brain className="h-3.5 w-3.5" aria-hidden="true" /> Intelligence with context
              </div>
              <h2 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">Not a generic score. Your evolving picture.</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Nutreluma brings meals, targets and progress into one calm view—then uses your history to make every next insight more relevant.
              </p>
              <Link href="/register" className="mt-7 inline-flex items-center gap-2 font-semibold text-primary hover:text-primary/80">
                Start building your pattern <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3 md:mt-0 md:pl-8">
              {proofPoints.map(({ Icon, label, body }) => (
                <div key={label} className="rounded-[1.4rem] border border-white/10 bg-black/15 p-4">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="mt-4 font-semibold">{label}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container max-w-7xl pb-16">
          <div className="flex flex-col items-center justify-between gap-6 border-y border-white/10 py-10 text-center md:flex-row md:text-left">
            <div><p className="text-sm font-semibold text-primary">Your next meal is enough to begin.</p><h2 className="mt-2 text-2xl font-semibold">See your patterns become clearer.</h2></div>
            <Link href="/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-semibold text-primary-foreground shadow-[0_16px_34px_-18px_hsl(var(--primary)/0.95)] hover:bg-primary/90">
              {t('nav.register')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8"><Disclaimer text={t('app.disclaimer')} /></div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/70 py-6">
        <div className="container flex max-w-7xl flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-1.5 sm:items-start"><JoybeeAttribution prefix={t('app.partOf')} /><span className="text-xs">{JOYBEE.copyright}</span></div>
          <div className="flex items-center gap-4"><Link href="/terms" className="hover:text-foreground">{t('terms.navLabel')}</Link><Link href="/privacy" className="hover:text-foreground">{t('nav.privacy')}</Link></div>
        </div>
      </footer>
    </div>
  );
}
