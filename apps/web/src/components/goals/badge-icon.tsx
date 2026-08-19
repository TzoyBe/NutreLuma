import * as React from 'react';
import {
  Activity,
  Award,
  Bookmark,
  Calendar,
  CalendarCheck2,
  ClipboardCheck,
  Clock3,
  Droplets,
  Egg,
  Flag,
  Flame,
  LucideIcon,
  Route,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Utensils,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | string;

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  flame: Flame,
  scale: Scale,
  'trending-down': TrendingDown,
  milestone: Route,
  trophy: Trophy,
  egg: Egg,
  target: Target,
  'clipboard-check': ClipboardCheck,
  bookmark: Bookmark,
  zap: Zap,
  droplet: Droplets,
  activity: Activity,
  flag: Flag,
  clock: Clock3,
  'calendar-check': CalendarCheck2,
  calendar: Calendar,
  award: Award,
  'trending-up': TrendingUp,
};

const tierStyles: Record<string, string> = {
  BRONZE: 'border-amber-500/30 bg-amber-500/12 text-amber-300',
  SILVER: 'border-slate-300/30 bg-slate-300/12 text-slate-100',
  GOLD: 'border-yellow-400/35 bg-yellow-400/12 text-yellow-200',
  PLATINUM: 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100',
};

const sizeStyles = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
} as const;

const glyphSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
} as const;

export function BadgeIcon({
  iconKey,
  tier,
  unlocked = false,
  size = 'md',
  className,
}: {
  iconKey?: string | null;
  tier?: BadgeTier;
  unlocked?: boolean;
  size?: keyof typeof sizeStyles;
  className?: string;
}) {
  const Icon = (iconKey ? ICONS[iconKey] : null) ?? Trophy;
  const tierClass = tier ? tierStyles[tier] ?? tierStyles.BRONZE : tierStyles.BRONZE;

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full border shadow-[0_1px_0_hsl(var(--glass-border)/0.4)_inset]',
        sizeStyles[size],
        unlocked ? tierClass : 'border-border bg-muted/50 text-muted-foreground',
        className,
      )}
    >
      {unlocked ? <span className="absolute inset-1 rounded-full bg-white/5" /> : null}
      <Icon className={cn('relative', glyphSizes[size])} aria-hidden="true" />
    </span>
  );
}
