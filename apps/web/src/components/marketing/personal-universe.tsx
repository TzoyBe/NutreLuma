import Image from 'next/image';
import { BarChart3, Brain, Target, Utensils } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

const orbitItems = [
  {
    className: 'universe-insight-node universe-insight-node-meals',
    Icon: Utensils,
    label: 'Meals',
    detail: 'Fuel your day',
    tone: 'text-primary',
  },
  {
    className: 'universe-insight-node universe-insight-node-goals',
    Icon: Target,
    label: 'Goals',
    detail: 'Small steps, real progress',
    tone: 'text-accent',
  },
  {
    className: 'universe-insight-node universe-insight-node-insights',
    Icon: Brain,
    label: 'Insights',
    detail: 'Learn from your patterns',
    tone: 'text-[hsl(var(--brand-purple))]',
  },
  {
    className: 'universe-insight-node universe-insight-node-progress',
    Icon: BarChart3,
    label: 'Progress',
    detail: 'See what is working',
    tone: 'text-emerald-400',
  },
] as const;

function MealNode({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  return (
    <div className={cn('universe-meal-node', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="(max-width: 768px) 96px, 144px"
        className="object-cover"
      />
    </div>
  );
}

export function PersonalUniverseConstellation({ compact = false }: { compact?: boolean }) {
  return (
    <div
      data-testid={compact ? 'personal-universe-auth-orbit' : 'personal-universe-constellation'}
      className={cn('universe-constellation', compact && 'universe-constellation-compact')}
      aria-label="Meals, goals, insights and progress connected around your personal nutrition pattern"
    >
      <div className="universe-ambient" aria-hidden="true" />
      <div className="universe-orbit universe-orbit-outer" aria-hidden="true" />
      <div className="universe-orbit universe-orbit-inner" aria-hidden="true" />

      <div className="universe-core glass glass-specular">
        <LogoMark className="h-14 w-14 sm:h-16 sm:w-16" />
        <p className="mt-4 text-center text-base font-semibold leading-snug sm:text-lg">
          Your pattern is
          <br />
          getting clearer
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
          Learning with you
        </span>
      </div>

      <MealNode
        src="/brand/meal-salmon-bowl.webp"
        alt="Grilled salmon bowl"
        className="universe-meal-node-salmon"
      />
      <MealNode
        src="/brand/meal-berry-bowl.webp"
        alt="Greek yogurt and berry bowl"
        className="universe-meal-node-berry"
      />
      <MealNode
        src="/brand/meal-green-bowl.webp"
        alt="Green smoothie bowl"
        className="universe-meal-node-green"
      />

      {!compact
        ? orbitItems.map(({ className, Icon, label, detail, tone }) => (
            <div key={label} className={cn('glass glass-specular', className)}>
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06]', tone)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <strong className="block text-sm font-semibold text-foreground">{label}</strong>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{detail}</span>
              </span>
            </div>
          ))
        : null}

      <span className="universe-particle universe-particle-blue" aria-hidden="true" />
      <span className="universe-particle universe-particle-gold" aria-hidden="true" />
      <span className="universe-particle universe-particle-teal" aria-hidden="true" />
      <span className="universe-particle universe-particle-violet" aria-hidden="true" />
    </div>
  );
}
