'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ChevronLeft, ChevronRight, Flame, Sparkles, TrendingDown, Trophy } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useT } from '@/i18n/client';
import type { TranslationKey } from '@/i18n';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo';

/**
 * Ξενάγηση καλωσορίσματος: full-screen carousel που δείχνει με λίγα λόγια τι
 * κάνει η εφαρμογή. Εμφανίζεται μία φορά μετά το onboarding. Κάθε slide έχει
 * ένα μικρό, ζωντανό preview της αντίστοιχης οθόνης — χωρίς εικόνες, μόνο SVG.
 */

type Slide = {
  id: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  Preview: React.ComponentType;
};

const SLIDES: Slide[] = [
  { id: 'welcome', titleKey: 'tour.welcomeTitle', bodyKey: 'tour.welcomeBody', Preview: WelcomePreview },
  { id: 'snap', titleKey: 'tour.snapTitle', bodyKey: 'tour.snapBody', Preview: SnapPreview },
  { id: 'track', titleKey: 'tour.trackTitle', bodyKey: 'tour.trackBody', Preview: TrackPreview },
  { id: 'progress', titleKey: 'tour.progressTitle', bodyKey: 'tour.progressBody', Preview: ProgressPreview },
  { id: 'goals', titleKey: 'tour.goalsTitle', bodyKey: 'tour.goalsBody', Preview: GoalsPreview },
];

export function WelcomeTour({ firstName }: { firstName: string }) {
  const t = useT();
  const router = useRouter();
  const [index, setIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [finishing, setFinishing] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);

  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const go = React.useCallback((next: number, dir: number) => {
    setDirection(dir);
    setIndex(next);
  }, []);

  const finish = React.useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await api.post('/api/onboarding/tour-seen');
    } catch {
      // Δεν μπλοκάρουμε τον χρήστη αν αποτύχει το flag — απλώς προχωράμε.
    }
    router.replace('/dashboard');
  }, [finishing, router]);

  const next = React.useCallback(() => {
    if (last) void finish();
    else go(index + 1, 1);
  }, [last, finish, go, index]);

  const back = React.useCallback(() => {
    if (index > 0) go(index - 1, -1);
  }, [index, go]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') next();
      else if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back]);

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) next();
    else back();
  };

  const Preview = slide.Preview;

  return (
    <main
      id="main"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)]"
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_18%,hsl(var(--primary)/0.16),transparent_58%)]"
      />

      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground/90">
          <LogoMark className="h-6 w-6" />
          Nutre<span className="-ml-1.5 text-primary">luma</span>
        </span>
        <button
          type="button"
          onClick={() => void finish()}
          disabled={finishing}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {t('tour.skip')}
        </button>
      </div>

      <section
        aria-roledescription="carousel"
        aria-label={t('tour.metaTitle')}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center"
      >
        <div
          key={index}
          className="tour-slide flex w-full flex-col items-center text-center"
          style={{ ['--tour-dx' as string]: direction >= 0 ? '1.75rem' : '-1.75rem' }}
        >
          <div className="grid h-60 w-full place-items-center">
            <Preview />
          </div>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">
            {t(slide.titleKey, { name: firstName })}
          </h1>
          <p className="mt-3 max-w-sm text-pretty text-base leading-relaxed text-muted-foreground">
            {t(slide.bodyKey)}
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="flex items-center justify-center gap-2" role="tablist" aria-label={t('tour.metaTitle')}>
          {SLIDES.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t('tour.stepLabel', { current: i + 1, total: SLIDES.length })}
              onClick={() => go(i, i > index ? 1 : -1)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-7 bg-primary' : 'w-2 bg-foreground/20 hover:bg-foreground/35'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {index > 0 ? (
            <Button variant="outline" size="lg" onClick={back} disabled={finishing} className="min-w-[6rem]">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t('tour.back')}
            </Button>
          ) : null}
          <Button size="lg" block onClick={next} loading={finishing && last}>
            {last ? t('tour.start') : t('tour.next')}
            {last ? null : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </main>
  );
}

/* ---------- Slide previews (SVG only, τα κύρια στοιχεία της κάθε οθόνης) ---------- */

function PreviewCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass glass-specular relative grid h-52 w-52 place-items-center rounded-[2rem]">
      {children}
    </div>
  );
}

function WelcomePreview() {
  return (
    <PreviewCard>
      <div className="tour-pop grid h-28 w-28 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.28),transparent_60%)] shadow-[0_0_50px_-12px_hsl(var(--primary)/0.8)]">
        <LogoMark className="h-20 w-20 drop-shadow-[0_0_16px_hsl(var(--primary)/0.35)]" />
      </div>
      <Sparkles className="tour-rise absolute right-6 top-6 h-6 w-6 text-primary" aria-hidden="true" />
      <Sparkles className="tour-rise absolute bottom-7 left-7 h-4 w-4 text-primary/70" aria-hidden="true" />
    </PreviewCard>
  );
}

function SnapPreview() {
  const chips = [
    { label: 'kcal', value: '540' },
    { label: 'P', value: '32g' },
    { label: 'C', value: '48g' },
    { label: 'F', value: '19g' },
  ];
  return (
    <PreviewCard>
      <div className="flex flex-col items-center gap-4">
        <div className="relative grid h-20 w-20 place-items-center rounded-full bg-[conic-gradient(from_140deg,hsl(var(--primary)/0.35),hsl(var(--accent)/0.3),hsl(var(--primary)/0.35))]">
          <div className="h-14 w-14 rounded-full bg-background/70" />
          <span className="tour-pop absolute -bottom-1.5 -right-1.5 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary))]">
            <Camera className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="tour-rise flex w-40 flex-wrap justify-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-medium text-foreground ring-1 ring-white/10"
            >
              <span className="tabular-nums">{chip.value}</span>{' '}
              <span className="text-muted-foreground">{chip.label}</span>
            </span>
          ))}
        </div>
      </div>
    </PreviewCard>
  );
}

function TrackPreview() {
  const r = 34;
  const len = 2 * Math.PI * r;
  const macros = [
    { w: '72%', color: 'bg-primary' },
    { w: '54%', color: 'bg-accent' },
    { w: '38%', color: 'bg-primary/70' },
  ];
  return (
    <PreviewCard>
      <div className="flex flex-col items-center gap-4">
        <div className="relative grid place-items-center">
          <svg viewBox="0 0 84 84" className="h-24 w-24 -rotate-90">
            <circle cx="42" cy="42" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="42"
              cy="42"
              r={r}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * 0.32}
              className="tour-ring"
              style={{ ['--tour-ring-len' as string]: `${len}` }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <Flame className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold tabular-nums text-foreground">1 480</span>
          </div>
        </div>
        <div className="w-36 space-y-2">
          {macros.map((macro, i) => (
            <div key={i} className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={`tour-grow h-full rounded-full ${macro.color}`} style={{ width: macro.w }} />
            </div>
          ))}
        </div>
      </div>
    </PreviewCard>
  );
}

function ProgressPreview() {
  // Απλή γραμμή τάσης που «σχεδιάζεται». Το μήκος είναι κατά προσέγγιση.
  const d = 'M8 66 L34 54 L60 58 L86 40 L112 44 L138 22';
  return (
    <PreviewCard>
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 150 84" className="h-24 w-40">
          <defs>
            <linearGradient id="tourTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
              <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L138 84 L8 84 Z`} fill="url(#tourTrend)" className="tour-rise" />
          <path
            d={d}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="320"
            strokeDashoffset="0"
            className="tour-draw"
            style={{ ['--tour-path-len' as string]: '320' }}
          />
          {[
            [34, 54],
            [86, 40],
            [138, 22],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3" fill="hsl(var(--primary))" className="tour-pop" />
          ))}
        </svg>
        <span className="tour-rise inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary ring-1 ring-primary/15">
          <TrendingDown className="h-4 w-4" aria-hidden="true" />
          <span className="tabular-nums">−2.4 kg</span>
        </span>
      </div>
    </PreviewCard>
  );
}

function GoalsPreview() {
  return (
    <PreviewCard>
      <div className="relative grid h-24 w-24 place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <span className="absolute inset-3 rounded-full border-2 border-primary/35" />
        <span className="tour-pop grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_14px_34px_-14px_hsl(var(--primary))]">
          <Trophy className="h-8 w-8" aria-hidden="true" />
        </span>
        <span className="tour-pop absolute -right-1 -top-1 grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_10px_22px_-10px_hsl(var(--accent))]">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="tour-rise absolute inset-x-6 bottom-5 h-2 overflow-hidden rounded-full bg-muted">
        <div className="tour-grow h-full rounded-full bg-primary" style={{ width: '78%' }} />
      </div>
    </PreviewCard>
  );
}
