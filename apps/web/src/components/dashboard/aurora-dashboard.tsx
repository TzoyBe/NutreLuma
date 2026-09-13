import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import {
  Apple,
  ChevronRight,
  Dna,
  Droplet,
  FilePlus2,
  Footprints,
  Leaf,
  Mic,
  Plus,
  ScanLine,
  Sparkles,
  Sprout,
  Wheat,
} from 'lucide-react';

import type { DashboardData } from '@/server/services/stats';
import { buildAuroraSummary, safeProgress } from './aurora-dashboard-model';
import styles from './aurora-dashboard.module.css';

type Metric = {
  key: string;
  label: string;
  current: number;
  target: number | null;
  unit: string;
  color: string;
  copy: string;
  Icon: typeof Dna;
};

function progressStyle(current: number, target: number | null, color: string) {
  return {
    '--progress': `${safeProgress(current, target) * 259.2}deg`,
    '--metric-color': color,
  } as CSSProperties;
}

function MetricBlob({ metric, index }: { metric: Metric; index: number }) {
  const target = metric.target === null ? '—' : Math.round(metric.target).toLocaleString();
  return (
    <Link
      href="/goals"
      className={`${styles.metricSlot} ${styles[`metric${index + 1}`]}`}
      aria-label={`${metric.label}: ${Math.round(metric.current)} of ${target}${metric.unit}`}
    >
      <div className={styles.metricBlob} style={progressStyle(metric.current, metric.target, metric.color)}>
        <div className={styles.metricCore}>
          <metric.Icon aria-hidden="true" />
          <span className={styles.metricLabel}>{metric.label}</span>
          <span className={styles.metricNumbers}>
            <strong>{Math.round(metric.current).toLocaleString()}</strong>
            <small> / {target}{metric.unit}</small>
          </span>
          <ChevronRight className={styles.metricArrow} aria-hidden="true" />
        </div>
      </div>
      <span className={styles.metricCopy}>{metric.copy}</span>
    </Link>
  );
}

function CalorieHero({ summary }: { summary: DashboardData['summary'] }) {
  const target = summary.target && summary.target > 0 ? summary.target : null;
  const fraction = safeProgress(summary.consumed, target);
  const percent = target ? Math.round(Math.max(0, summary.consumed / target) * 100) : 0;
  return (
    <Link
      href="/goals"
      className={styles.calorieHero}
      style={progressStyle(summary.consumed, target, '#FFD66B')}
      aria-label={`${Math.round(summary.consumed)} calories, ${percent}% of goal`}
    >
      <div className={styles.calorieGlass}>
        <div className={styles.calorieArc} style={{ '--cap-angle': `${fraction * 259.2 - 129.6}deg` } as CSSProperties} />
        <div className={styles.calorieContent}>
          <span className={styles.calorieLabel}>CALORIES</span>
          <strong>{Math.round(summary.consumed)}</strong>
          <span>{target ? `of ${Math.round(target)} kcal` : 'No target set'}</span>
          <b>{percent}%</b>
        </div>
      </div>
    </Link>
  );
}

function SmartSummary({ message }: { message: string }) {
  return (
    <Link href="/insights" className={styles.summaryCard}>
      <span className={styles.summaryHeading}><Sparkles aria-hidden="true" /> Smart Summary</span>
      <p>{message}</p>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

function SmartLogBar({ canWrite }: { canWrite: boolean }) {
  const mealHref = canWrite ? '/meals/add' : '/profile/billing';
  return (
    <div className={styles.logBar}>
      <Link href={mealHref} className={styles.logPrompt}><Sparkles aria-hidden="true" /><span>What would you like to log?</span></Link>
      <Link href={mealHref} className={styles.logIcon} aria-label="Scan food"><ScanLine aria-hidden="true" /></Link>
      <Link href={mealHref} className={styles.logIcon} aria-label="Log food manually"><Mic aria-hidden="true" /></Link>
      <Link href={mealHref} className={styles.logAdd} aria-label="Add entry"><Plus aria-hidden="true" /></Link>
    </div>
  );
}

function QuickActions({ canWrite }: { canWrite: boolean }) {
  const mealHref = canWrite ? '/meals/add' : '/profile/billing';
  const actions = [
    { label: 'Meal', href: mealHref, Icon: Apple, color: '#FF8E8E' },
    { label: 'Water', href: '/goals', Icon: Droplet, color: '#38CFFF' },
    { label: 'Activity', href: '/goals', Icon: Footprints, color: '#7C8CFF' },
    { label: 'Quick Add', href: mealHref, Icon: FilePlus2, color: '#3CE2BE' },
  ];
  return <div className={styles.quickActions}>{actions.map(({ label, href, Icon, color }) => <Link key={label} href={href}><Icon style={{ color }} aria-hidden="true" /><span>{label}</span></Link>)}</div>;
}

export function AuroraDashboard({
  dashboard,
  displayName,
  canWrite,
  waterMl,
  steps,
  dateControl,
  activityControls,
  meals,
}: {
  dashboard: DashboardData;
  displayName: string;
  canWrite: boolean;
  waterMl: number;
  steps: number;
  dateControl: ReactNode;
  activityControls: ReactNode;
  meals: ReactNode;
}) {
  const { summary, macros, goal } = dashboard;
  const metrics: Metric[] = [
    { key: 'protein', label: 'Protein', current: macros.protein.consumed, target: macros.protein.target, unit: 'g', color: '#42B8FF', copy: 'Build stronger', Icon: Dna },
    { key: 'carbohydrate', label: 'Carbs', current: macros.carbohydrate.consumed, target: macros.carbohydrate.target, unit: 'g', color: '#FFC95B', copy: "Energy for what's next", Icon: Wheat },
    { key: 'fat', label: 'Fat', current: macros.fat.consumed, target: macros.fat.target, unit: 'g', color: '#EA63F7', copy: 'Good fats, bright minds', Icon: Droplet },
    { key: 'fiber', label: 'Fibre', current: macros.fiber.consumed, target: macros.fiber.target, unit: 'g', color: '#42E89A', copy: 'A happier you inside', Icon: Leaf },
    { key: 'water', label: 'Water', current: waterMl, target: goal.waterMl, unit: 'ml', color: '#39AEFF', copy: 'Hydrate for a clearer you', Icon: Droplet },
    { key: 'steps', label: 'Steps', current: steps, target: goal.stepsTarget, unit: '', color: '#36DFD7', copy: 'Move for a brighter mood', Icon: Footprints },
  ];
  const firstName = displayName.trim().split(/\s+/)[0];

  return (
    <div className={styles.dashboard}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.mobileIntro}>
        <div className={styles.brand}><Sparkles aria-hidden="true" /><div><b>N U T R E L U M A</b><span>Nourish a brighter you</span></div></div>
        <div className={styles.welcome}><span>GOOD MORNING{firstName ? `, ${firstName.toUpperCase()}` : ''}</span><h1>Progress<br />looks good <b>✦</b></h1><p>Small choices<br />shape a brighter you.</p></div>
        <div className={styles.wellnessOrb}><Sprout aria-hidden="true" /><p>Fuel today.<br />A brighter<br />tomorrow.</p></div>
      </div>

      <aside className={styles.leftRail}>
        <div className={styles.desktopWelcome}><span>GOOD MORNING{firstName ? `, ${firstName.toUpperCase()}` : ''}</span><h1>Progress<br />looks good <b>✦</b></h1><p>Small choices shape a brighter you.</p></div>
        {dateControl}
        <SmartSummary message={buildAuroraSummary(summary.consumed, summary.target)} />
        <QuickActions canWrite={canWrite} />
      </aside>

      <section className={styles.metricUniverse} aria-label="Daily progress">
        <CalorieHero summary={summary} />
        {metrics.map((metric, index) => <MetricBlob key={metric.key} metric={metric} index={index} />)}
      </section>

      <aside className={styles.rightRail}>
        <div className={styles.wellnessOrbDesktop}><Sprout aria-hidden="true" /><p>Fuel today.<br />A brighter tomorrow.</p></div>
        <section className={styles.contextPanel}><h2>Today&apos;s rhythm</h2><div className={styles.activityControls}>{activityControls}</div></section>
        <section className={styles.contextPanel}><h2>Today&apos;s meals</h2>{meals}</section>
      </aside>

      <div className={styles.mobileTools}>
        <SmartSummary message={buildAuroraSummary(summary.consumed, summary.target)} />
        <SmartLogBar canWrite={canWrite} />
        <QuickActions canWrite={canWrite} />
      </div>
      <div className={styles.desktopLog}><SmartLogBar canWrite={canWrite} /></div>
    </div>
  );
}
