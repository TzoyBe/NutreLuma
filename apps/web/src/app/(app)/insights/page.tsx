import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { BrainCircuit, CalendarCheck, Gauge, Lightbulb } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { getDailyDataQuality, getPersonalCalibration, getPersonalEnergyEstimate, getPersonalPatterns, getCorrectionRates } from '@/server/services/personal-intelligence';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { todayISO } from '@/lib/dates';
import { IntelligenceSettings } from '@/components/intelligence/intelligence-panel';
import { getT } from '@/i18n/locale';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> { const t = await getT(); return { title: t('insights.title') }; }

export default async function InsightsPage() {
  const user = await requirePageUser();
  const t = await getT();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');
  const today = todayISO(profile.timezone);
  const [calibration, rates, quality, patterns, energy, settings] = await Promise.all([
    getPersonalCalibration(user.id), getCorrectionRates(user.id), getDailyDataQuality(user.id, today, profile.timezone), getPersonalPatterns(user.id, profile.timezone), getPersonalEnergyEstimate(user.id, profile.timezone),
    import('@/server/services/personal-intelligence').then(({ getIntelligenceSettings }) => getIntelligenceSettings(user.id)),
  ]);
  const levelLabels: Record<string, string> = {
    HIGH: t('insights.levelHigh'),
    MEDIUM: t('insights.levelMedium'),
    LOW: t('insights.levelLow'),
    UNKNOWN: t('insights.levelUnknown'),
  };
  return <>
    <div className="space-y-1"><h1 className="text-xl font-semibold">{t('insights.title')}</h1><p className="text-sm text-muted-foreground">{t('insights.subtitle')}</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={<BrainCircuit className="h-4 w-4" aria-hidden="true" />} label={t('insights.calibration')} value={`${calibration.score}%`} detail={`${calibration.corrections} ${t('insights.corrections')}`} />
      <Metric icon={<Gauge className="h-4 w-4" aria-hidden="true" />} label={t('insights.dataConfidence')} value={`${quality.score}%`} detail={levelLabels[quality.level] ?? quality.level} />
      <Metric icon={<CalendarCheck className="h-4 w-4" aria-hidden="true" />} label={t('insights.correctionRate')} value={`${rates['30d']}%`} detail={t('insights.last30Days')} />
    </div>
    {energy ? <Card><CardHeader><CardTitle>{t('insights.energyEstimate')}</CardTitle><CardDescription>{t('insights.energyDescription')}</CardDescription></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{energy.estimatedCalories} <span className="text-base font-normal text-muted-foreground">{t('insights.perDay')}</span></p><p className="mt-1 text-sm text-muted-foreground">{t('insights.confidence')} {Math.round(energy.confidence * 100)}% · {energy.completeDays} {t('insights.completeDays')}</p></CardContent></Card> : null}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" aria-hidden="true" />{t('insights.usefulPatterns')}</CardTitle></CardHeader><CardContent className="space-y-3">{patterns.length ? patterns.map((pattern) => <div key={pattern.type} className="border-b border-border pb-3 last:border-0 last:pb-0"><p className="font-medium">{t('insights.weekendPatternTitle')}</p><p className="text-sm text-muted-foreground">{t(pattern.weekendHigher ? 'insights.patternWeekendHigher' : 'insights.patternWeekdayHigher', { kcal: pattern.deltaKcal })}</p><p className="mt-1 text-xs text-muted-foreground">{pattern.sampleCount} {t('insights.trackedMeals')} · {Math.round(pattern.confidence * 100)}% {t('insights.strength')}</p></div>) : <p className="text-sm text-muted-foreground">{t('insights.moreData')}</p>}</CardContent></Card>
    <IntelligenceSettings initial={settings} />
  </>;
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <Card><CardContent className="space-y-2 p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}
