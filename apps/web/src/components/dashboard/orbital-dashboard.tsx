import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import {
  Bell,
  Bot,
  CalendarDays,
  ChefHat,
  ChevronRight,
  Flame,
  Footprints,
  House,
  Leaf,
  Plus,
  Sparkles,
  UserRound,
  Wheat,
  Dumbbell,
  Droplets,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';

import type { buildOrbitalDashboardModel } from './orbital-dashboard-model';
import styles from './orbital-dashboard.module.css';

type Model = ReturnType<typeof buildOrbitalDashboardModel>;
type Metric = Model['metrics'][number];

type OrbitalDashboardProps = {
  model: Model;
  dateLabel: string;
  dateControl: ReactNode;
  canWrite: boolean;
  unreadNotifications?: number;
  waterControl: ReactNode;
  stepsControl: ReactNode;
};

const icons = {
  protein: Dumbbell,
  carbohydrate: Wheat,
  fat: Droplets,
  fiber: Leaf,
  water: Droplets,
  steps: Footprints,
} as const;

function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true"><span /></span>
      <span><strong>N U T R E L U M A</strong><small>F U E L &nbsp; A &nbsp; B R I G H T E R &nbsp; Y O U</small></span>
    </div>
  );
}

function Insight({ item, variant, href }: { item: Model['insights'][number]; variant: 'blue' | 'green'; href: string }) {
  const Icon = variant === 'blue' ? Bot : Leaf;
  return (
    <Link href={href} className={`${styles.insight} ${styles[variant]}`} aria-label={`${item.title}. ${item.body}`}>
      <span className={styles.insightIcon}><Icon aria-hidden="true" /></span>
      <span className={styles.insightText}><strong>{item.title}</strong><span>{item.body}</span></span>
      <ChevronRight className={styles.chevron} aria-hidden="true" />
    </Link>
  );
}

function MetricPlanet({ metric, className }: { metric: Metric; className: string }) {
  const Icon = icons[metric.key];
  const target = metric.target && metric.target > 0 ? Math.round(metric.target).toLocaleString() : '—';
  const style = {
    '--metric': metric.color,
    '--progress': `${metric.progress * 280}deg`,
  } as CSSProperties;
  return (
    <Link href="/goals" className={`${styles.metricPlanet} ${className}`} style={style} aria-label={`${metric.label}, ${Math.round(metric.current)} of ${target} ${metric.unit}`}>
      <span className={styles.metricArc} aria-hidden="true" />
      <Icon aria-hidden="true" />
      <strong>{metric.label}</strong>
      <b>{Math.round(metric.current).toLocaleString()}<small>{metric.unit}</small></b>
      <span>of {target}{metric.unit}</span>
    </Link>
  );
}

function CaloriePlanet({ calories }: { calories: Model['calories'] }) {
  const target = calories.target && calories.target > 0 ? Math.round(calories.target).toLocaleString() : '—';
  return (
    <Link href="/goals" className={styles.caloriePlanet} style={{ '--calorie-progress': `${calories.progress * 285}deg` } as CSSProperties} aria-label={`${Math.round(calories.current)} of ${target} calories, ${calories.percent}%`}>
      <span className={styles.calorieArc} aria-hidden="true" />
      <span className={styles.calorieCore}>
        <Flame aria-hidden="true" />
        <strong>{Math.round(calories.current).toLocaleString()}</strong>
        <span>of {target} kcal</span>
        <b>{calories.percent}%</b>
      </span>
    </Link>
  );
}

function MobileNav({ canWrite }: { canWrite: boolean }) {
  const items = [
    { href: '/dashboard', label: 'Home', Icon: House },
    { href: '/insights', label: 'Insights', Icon: ChartNoAxesColumnIncreasing },
    { href: '/recipes', label: 'Recipes', Icon: ChefHat },
    { href: '/profile', label: 'Profile', Icon: UserRound },
  ];
  return (
    <nav className={styles.mobileNav} aria-label="Dashboard shortcuts">
      {items.map(({ href, label, Icon }, index) => (
        <span className={styles.navSlot} key={href}>
          {index === 2 ? (
            <Link href={canWrite ? '/meals/add' : '/profile/billing'} className={styles.addMeal} aria-label={canWrite ? 'Add meal' : 'Subscription required'}><Plus aria-hidden="true" /><em>Add Meal</em></Link>
          ) : null}
          <Link href={href} className={label === 'Home' ? styles.activeNav : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>
        </span>
      ))}
    </nav>
  );
}

export function OrbitalDashboard({ model, dateLabel, dateControl, canWrite, unreadNotifications = 0, waterControl, stepsControl }: OrbitalDashboardProps) {
  const metric = (key: Metric['key']) => model.metrics.find((item) => item.key === key)!;
  return (
    <section className={styles.shell} aria-label="Daily nutrition dashboard">
      <div className={styles.space} aria-hidden="true"><span /><span /><span /></div>
      <header className={styles.header}>
        <Brand />
        <Link href="/settings" className={styles.bell} aria-label={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'}><Bell aria-hidden="true" />{unreadNotifications ? <span>{unreadNotifications > 9 ? '9+' : unreadNotifications}</span> : null}</Link>
      </header>

      <div className={styles.welcome}>
        <div><p>{model.greeting},</p><h1>{model.headline} <span>✦</span></h1><small>Small choices create big tomorrows.</small></div>
        <div className={styles.dateCard}><CalendarDays aria-hidden="true" /><strong>{dateLabel}</strong><div>{dateControl}</div></div>
      </div>

      <blockquote className={styles.quote}>“Progress<br />lives here”</blockquote>

      <div className={styles.insights}>
        <Insight item={model.insights[0]} variant="blue" href={canWrite ? '/meals/add' : '/profile/billing'} />
        <Insight item={model.insights[1]} variant="green" href="/goals" />
      </div>

      <div className={styles.orbitStage}>
        <span className={`${styles.orbit} ${styles.orbitOuter}`} aria-hidden="true" />
        <span className={`${styles.orbit} ${styles.orbitInner}`} aria-hidden="true" />
        <span className={`${styles.orbitNode} ${styles.nodeOne}`} aria-hidden="true" />
        <span className={`${styles.orbitNode} ${styles.nodeTwo}`} aria-hidden="true" />
        <span className={`${styles.orbitNode} ${styles.nodeThree}`} aria-hidden="true" />
        <CaloriePlanet calories={model.calories} />
        <MetricPlanet metric={metric('protein')} className={styles.protein} />
        <MetricPlanet metric={metric('carbohydrate')} className={styles.carbs} />
        <MetricPlanet metric={metric('fat')} className={styles.fat} />
        <MetricPlanet metric={metric('fiber')} className={styles.fiber} />
        <span className={styles.fuel}>F U E L &nbsp; T O D A Y</span>
      </div>

      <p className={styles.balance}>B A L A N C E<br />F U E L S &nbsp; A &nbsp; B R I G H T E R &nbsp; Y O U</p>
      <div className={styles.activities}>
        <div className={styles.activity}>{waterControl}</div>
        <div className={styles.activity}>{stepsControl}</div>
      </div>

      <Link href="/insights" className={styles.focusCard}>
        <span className={styles.focusMoon}><Sparkles aria-hidden="true" /></span>
        <span><small>Today's focus</small><strong>{model.focus.title}</strong><p>{model.focus.body}</p></span>
        <ChevronRight aria-hidden="true" />
      </Link>
      <MobileNav canWrite={canWrite} />
    </section>
  );
}
