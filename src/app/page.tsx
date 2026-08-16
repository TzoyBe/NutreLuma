import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Camera,
  CheckCircle2,
  Flame,
  LineChart,
  ScanLine,
  Sparkles,
  Target,
  Utensils,
} from 'lucide-react';
import { Disclaimer } from '@/components/ui/misc';
import { Logo } from '@/components/brand/logo';
import { JOYBEE, JoybeeAttribution } from '@/components/brand/joybee';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getT } from '@/i18n/locale';

const stats = [
  { label: 'Photo analysis', value: 'AI' },
  { label: 'Daily overview', value: '4' },
  { label: 'Smart nudges', value: '24h' },
] as const;

const workflow = [
  {
    Icon: Camera,
    title: 'Snap a meal',
    body: 'Use a photo to start the log quickly, then adjust anything you know better.',
  },
  {
    Icon: BarChart3,
    title: 'See the day',
    body: 'Calories, protein, carbs, fat and fibre stay visible without digging.',
  },
  {
    Icon: Bell,
    title: 'Stay on track',
    body: 'Gentle reminders help you remember meals before the details fade.',
  },
] as const;

const insights = [
  'Meal history',
  'Weight trends',
  'Goal milestones',
  'Recipe ideas',
] as const;

export default async function LandingPage() {
  const t = await getT();

  return (
    <div className="min-h-dvh overflow-hidden">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="container px-0">
          <div className="liquid-top-nav pointer-events-auto flex min-h-16 items-center justify-between gap-3 overflow-visible px-3 py-2">
            <Logo />
            <nav className="flex items-center gap-2" aria-label={t('nav.menu')}>
              <LanguageSwitcher className="mr-0.5 hidden xs:block" />
              <Link
                href="/login"
                className="liquid-nav-link rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground sm:px-4"
              >
                {t('nav.login')}
              </Link>
              <Link
                href="/register"
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_1px_0_hsl(var(--glass-border)/0.42)_inset,0_12px_26px_-14px_hsl(var(--primary)/0.95)] hover:bg-primary/90"
              >
                {t('nav.register')}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="relative min-h-[92dvh] overflow-hidden pt-28">
          <Image
            src="/brand/hero.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="pointer-events-none object-cover opacity-[0.16]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.72),hsl(var(--background)/0.96)_78%,hsl(var(--background)))]" />

          <div className="container relative grid min-h-[calc(92dvh-7rem)] items-center gap-10 pb-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="max-w-2xl space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Smart apps. Real impact.
              </div>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold leading-[1.04] sm:text-5xl lg:text-6xl">
                  Nutre<span className="text-primary">Luma</span>
                </h1>
                <p className="max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  A polished nutrition companion that turns meal photos into clear daily insight,
                  gentle reminders and progress you can actually follow.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-semibold text-primary-foreground shadow-[0_16px_34px_-18px_hsl(var(--primary)/0.95)] transition-transform hover:bg-primary/90 active:scale-[0.97]"
                >
                  {t('landing.ctaPrimary')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="liquid-control inline-flex h-12 items-center justify-center rounded-full px-7 font-semibold transition-transform active:scale-[0.97]"
                >
                  {t('landing.ctaSecondary')}
                </Link>
              </div>

              <div className="grid max-w-xl grid-cols-3 gap-2">
                {stats.map((item) => (
                  <div key={item.label} className="glass-subtle rounded-2xl px-3 py-3">
                    <p className="text-lg font-semibold text-foreground">{item.value}</p>
                    <p className="mt-1 text-xs leading-4 text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[35rem]">
              <div className="landing-phone mx-auto w-[min(21rem,86vw)] rounded-[2.4rem] border border-white/14 bg-black/22 p-3 shadow-[0_34px_90px_-44px_hsl(var(--primary)/0.75)]">
                <div className="glass glass-specular overflow-hidden rounded-[1.9rem]">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Today</p>
                      <p className="font-semibold">Lunch scan</p>
                    </div>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
                      <ScanLine className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>

                  <div className="relative mx-4 mt-4 aspect-[4/3] overflow-hidden rounded-[1.4rem] border border-white/10 bg-[linear-gradient(135deg,hsl(var(--accent)/0.18),hsl(var(--primary)/0.16)),url('/og.png')] bg-cover bg-center">
                    <div className="absolute inset-0 bg-black/28" />
                    <div className="landing-scan-line absolute inset-x-4 top-4 h-0.5 rounded-full bg-accent shadow-[0_0_22px_hsl(var(--accent)/0.9)]" />
                    <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/12 bg-black/35 px-3 py-2 backdrop-blur-md">
                      <p className="text-xs font-semibold text-white">AI estimate ready</p>
                      <p className="mt-0.5 text-[11px] text-white/70">Confidence, macros and notes grouped.</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['612', 'kcal'],
                        ['38g', 'protein'],
                        ['52g', 'carbs'],
                      ].map(([value, label]) => (
                        <div key={label} className="rounded-2xl border border-white/8 bg-white/5 p-3">
                          <p className="text-lg font-semibold">{value}</p>
                          <p className="text-[11px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-primary/18 bg-primary/10 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-primary">Daily target</span>
                        <span className="text-muted-foreground">68%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-black/25">
                        <div className="landing-meter h-full rounded-full bg-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="landing-float-card glass absolute -right-1 top-10 hidden w-48 rounded-2xl p-3 sm:block">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-accent">
                    <Flame className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Smart nudge</p>
                    <p className="text-xs text-muted-foreground">Dinner reminder at 21:00</p>
                  </div>
                </div>
              </div>

              <div className="landing-float-card landing-float-card-alt glass absolute -left-2 bottom-12 hidden w-52 rounded-2xl p-3 sm:block">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Progress saved</p>
                    <p className="text-xs text-muted-foreground">Meals, weight and goals in sync.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/20 py-10">
          <div className="container grid gap-4 md:grid-cols-3">
            {workflow.map(({ Icon, title, body }) => (
              <article key={title} className="glass glass-specular rounded-[1.5rem] p-5">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container grid gap-8 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase text-accent">Built for daily use</p>
            <h2 className="max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
              Less tracking friction, more useful feedback.
            </h2>
            <p className="max-w-xl leading-7 text-muted-foreground">
              NutreLuma keeps the important pieces close: what you ate, how the day is trending,
              where your goals stand, and what deserves attention next.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((item, index) => (
              <div
                key={item}
                className="liquid-control rounded-2xl p-4"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/12 text-accent">
                    {index % 2 === 0 ? (
                      <LineChart className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Target className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="font-semibold">{item}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Clear, calm and actionable.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="container pb-16">
          <div className="glass glass-specular grid gap-6 rounded-[2rem] p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Utensils className="h-4 w-4" aria-hidden="true" />
                Ready when your next meal is
              </div>
              <h2 className="text-2xl font-semibold">Start with one photo. Build a better rhythm.</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Create an account, verify your email and let NutreLuma guide the daily flow.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-semibold text-primary-foreground shadow-[0_16px_34px_-18px_hsl(var(--primary)/0.95)] hover:bg-primary/90"
            >
              {t('nav.register')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="container pb-12">
          <Disclaimer text={t('app.disclaimer')} />
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container flex flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <JoybeeAttribution prefix={t('app.partOf')} />
            <span className="text-xs">{JOYBEE.copyright}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
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
