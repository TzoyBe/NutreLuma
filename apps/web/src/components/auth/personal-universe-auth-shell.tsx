import Link from 'next/link';
import { PersonalUniverseConstellation } from '@/components/marketing/personal-universe';
import { Logo } from '@/components/brand/logo';
import { JoybeeAttribution } from '@/components/brand/joybee';
import { LanguageSwitcher } from '@/components/language-switcher';

export function PersonalUniverseAuthShell({
  title,
  subtitle,
  backLabel,
  partOfLabel,
  children,
}: {
  title: string;
  subtitle: string;
  backLabel: string;
  partOfLabel: string;
  children: React.ReactNode;
}) {
  return (
    <main
      id="main"
      data-testid="personal-universe-auth-shell"
      className="universe-auth-shell relative min-h-dvh overflow-hidden"
    >
      <div className="universe-page-glow" aria-hidden="true" />

      <header className="absolute inset-x-0 top-0 z-20 px-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="container flex max-w-7xl items-center justify-between px-0">
          <Link href="/" aria-label="Nutreluma home" className="liquid-brand -ml-2 px-2 py-1.5">
            <Logo markClassName="h-9 w-9" className="text-lg" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/" className="liquid-control rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
              {backLabel}
            </Link>
          </div>
        </div>
      </header>

      <div className="container relative z-10 grid min-h-dvh max-w-7xl items-center gap-10 pb-10 pt-28 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        <section className="relative hidden min-h-[38rem] lg:flex lg:items-center lg:justify-center" aria-label="Nutreluma personal universe">
          <PersonalUniverseConstellation compact />
          <div className="absolute bottom-3 left-0 max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Nutrition that learns you.</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">A clearer picture, meal by meal.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your meals, goals and progress connect into guidance that becomes more personal over time.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[34rem]">
          <div className="glass glass-specular rounded-[2rem] p-5 shadow-[0_34px_100px_-42px_hsl(var(--primary)/0.56)] sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nutreluma</p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
          <div className="mt-6 flex justify-center">
            <JoybeeAttribution prefix={partOfLabel} />
          </div>
        </section>
      </div>
    </main>
  );
}
