'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  History,
  Pause,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { Progress } from '@/components/ui/misc';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import { localizeAchievement } from '@/lib/achievement-localization';
import { BadgeIcon } from '@/components/goals/badge-icon';
import {
  filterMilestoneHistory,
  partitionMilestones,
  type MilestoneStatusFilter,
} from '@/lib/milestone-display';

type Milestone = {
  id: string;
  title: string;
  type: string;
  unit: string | null;
  currentValue: number;
  targetValue: number;
  dailyThreshold: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
  percent: number;
};

type MilestoneView = 'overview' | 'inProgress' | 'history' | 'editor';

type Achievement = {
  code: string;
  name: string;
  description: string;
  icon: string;
  badgeCode: string;
  unlocked: boolean;
};
type Badge = {
  code: string;
  name: string;
  description: string;
  iconKey: string;
  tier: string;
  unlocked: boolean;
};
type Suggestion = {
  title: string;
  description: string;
  type: string;
  targetValue: number;
  dailyThreshold: number | null;
  unit: string;
  startDate: string;
  endDate: string;
};

const TYPE_OPTIONS = [
  { value: 'MEAL_LOGGING_DAYS', label: 'Meal logging days' },
  { value: 'MEAL_LOGGING_STREAK', label: 'Logging streak' },
  { value: 'WEIGH_IN_FREQUENCY', label: 'Weigh-ins' },
  { value: 'WATER_TARGET_DAYS', label: 'Water target days' },
  { value: 'STEP_TARGET_DAYS', label: 'Step target days' },
  { value: 'ACTIVITY_TARGET', label: 'Activity target' },
  { value: 'CUSTOM_NUMERIC', label: 'Custom numeric goal' },
];

const statusLabels: Record<string, string> = {
  ACTIVE: 'In progress',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  MISSED: 'Missed',
};

function metric(value: number) {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
}

function statusClass(status: string) {
  if (status === 'COMPLETED') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  if (status === 'ACTIVE') return 'border-primary/25 bg-primary/10 text-primary';
  if (status === 'PAUSED') return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
  return 'border-border bg-muted text-muted-foreground';
}

export function AchievementsPanel({
  milestones,
  achievements,
  badges,
  suggestions,
  today,
}: {
  milestones: Milestone[];
  achievements: Achievement[];
  badges: Badge[];
  suggestions: Suggestion[];
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const english = t('achievements.achievements') === 'Achievements';
  const [busy, setBusy] = React.useState<string | null>(null);
  const [view, setView] = React.useState<MilestoneView>('overview');
  const [historyFilter, setHistoryFilter] = React.useState<MilestoneStatusFilter>('COMPLETED');
  const [editingMilestoneId, setEditingMilestoneId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState('MEAL_LOGGING_DAYS');
  const [targetValue, setTargetValue] = React.useState('5');
  const [dailyThreshold, setDailyThreshold] = React.useState('');
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState('');

  const { inProgress: inProgressMilestones, history: milestoneHistory } = partitionMilestones(milestones);
  const visibleHistory = filterMilestoneHistory(milestoneHistory, historyFilter);
  const activeMilestones = inProgressMilestones.filter((milestone) => milestone.status === 'ACTIVE');
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);
  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const nextMilestone = activeMilestones
    .slice()
    .sort((a, b) => b.percent - a.percent)[0];

  async function run(key: string, action: () => Promise<unknown>, success?: string) {
    if (busy) return false;
    setBusy(key);
    try {
      await action();
      if (success) toast.push(success, 'success');
      router.refresh();
      return true;
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('achievements.somethingWentWrong'), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  }

  function milestonePayload(source?: Suggestion) {
    return {
      title: source?.title ?? title,
      type: source?.type ?? type,
      targetValue: source?.targetValue ?? Number(targetValue),
      startDate: source?.startDate ?? startDate,
      endDate: source?.endDate ?? (endDate || undefined),
      dailyThreshold:
        source?.dailyThreshold ?? (dailyThreshold ? Number(dailyThreshold) : undefined),
    };
  }

  function applySuggestion(suggestion: Suggestion) {
    setEditingMilestoneId(null);
    setTitle(suggestion.title);
    setType(suggestion.type);
    setTargetValue(String(suggestion.targetValue));
    setDailyThreshold(suggestion.dailyThreshold ? String(suggestion.dailyThreshold) : '');
    setStartDate(suggestion.startDate || today);
    setEndDate(suggestion.endDate);
    setView('editor');
  }

  function resetMilestoneForm() {
    setEditingMilestoneId(null);
    setTitle('');
    setType('MEAL_LOGGING_DAYS');
    setTargetValue('5');
    setDailyThreshold('');
    setStartDate(today);
    setEndDate('');
  }

  function createMilestone() {
    resetMilestoneForm();
    setView('editor');
  }

  function editMilestone(milestone: Milestone) {
    setEditingMilestoneId(milestone.id);
    setTitle(milestone.title);
    setType(milestone.type);
    setTargetValue(String(milestone.targetValue));
    setDailyThreshold(milestone.dailyThreshold ? String(milestone.dailyThreshold) : '');
    setStartDate(milestone.startDate || today);
    setEndDate(milestone.endDate ?? '');
    setView('editor');
  }

  if (view === 'inProgress') {
    return (
      <div className="space-y-5">
        <MilestoneScreenHeader
          title={t('achievements.inProgress')}
          subtitle={t('achievements.inProgressDescription')}
          onBack={() => setView('overview')}
          action={<Button type="button" onClick={createMilestone}><Plus className="h-4 w-4" aria-hidden="true" />{t('achievements.createMilestone')}</Button>}
        />
        <div className="space-y-3">
          {inProgressMilestones.length ? inProgressMilestones.map((milestone) => (
            <MilestoneRow key={milestone.id} milestone={milestone}>
              <Button type="button" size="sm" variant="outline" onClick={() => editMilestone(milestone)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                {t('common.edit')}
              </Button>
              {milestone.status === 'ACTIVE' ? (
                <Button type="button" size="sm" variant="ghost" loading={busy === `pause:${milestone.id}`} onClick={() => void run(`pause:${milestone.id}`, () => api.post(`/api/milestones/${milestone.id}/pause`))}>
                  <Pause className="h-4 w-4" aria-hidden="true" />{t('achievements.pause')}
                </Button>
              ) : (
                <Button type="button" size="sm" variant="ghost" loading={busy === `resume:${milestone.id}`} onClick={() => void run(`resume:${milestone.id}`, () => api.post(`/api/milestones/${milestone.id}/resume`))}>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />{t('achievements.resume')}
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" loading={busy === `cancel:${milestone.id}`} onClick={() => void run(`cancel:${milestone.id}`, () => api.post(`/api/milestones/${milestone.id}/cancel`))}>
                <X className="h-4 w-4" aria-hidden="true" />{t('achievements.cancelGoal')}
              </Button>
            </MilestoneRow>
          )) : <EmptyState text={t('achievements.noInProgress')} />}
        </div>
      </div>
    );
  }

  if (view === 'history') {
    const filters: MilestoneStatusFilter[] = ['COMPLETED', 'MISSED', 'CANCELLED', 'ALL'];
    return (
      <div className="space-y-5">
        <MilestoneScreenHeader
          title={t('achievements.history')}
          subtitle={t('achievements.historyDescription')}
          onBack={() => setView('overview')}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('achievements.historyFilters')}>
          {filters.map((filter) => (
            <Button key={filter} type="button" size="sm" variant={historyFilter === filter ? 'primary' : 'outline'} aria-pressed={historyFilter === filter} onClick={() => setHistoryFilter(filter)}>
              {filter === 'ALL' ? t('achievements.all') : filter === 'COMPLETED' ? t('achievements.completed') : filter === 'MISSED' ? t('achievements.missed') : t('achievements.cancelled')}
            </Button>
          ))}
        </div>
        <div className="space-y-3">
          {visibleHistory.length ? visibleHistory.map((milestone) => <MilestoneRow key={milestone.id} milestone={milestone} />) : <EmptyState text={t('achievements.noHistory')} />}
        </div>
      </div>
    );
  }

  if (view === 'editor') {
    const editing = Boolean(editingMilestoneId);
    return (
      <div className="space-y-5">
        <MilestoneScreenHeader
          title={editing ? t('achievements.editMilestone') : t('achievements.createMilestone')}
          subtitle={editing ? t('achievements.editMilestoneDescription') : t('achievements.customMilestoneDescription')}
          onBack={() => setView(editing ? 'inProgress' : 'overview')}
        />
        <Card className="mx-auto w-full max-w-2xl border-primary/20">
          <CardContent className="pt-6">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void (async () => {
                  const success = await run(
                    editing ? `edit:${editingMilestoneId}` : 'create',
                    () => editing
                      ? api.patch(`/api/milestones/${editingMilestoneId}`, milestonePayload())
                      : api.post('/api/milestones', milestonePayload()),
                    editing ? t('achievements.milestoneSaved') : t('achievements.milestoneCreated'),
                  );
                  if (success) {
                    resetMilestoneForm();
                    setView('inProgress');
                  }
                })();
              }}
            >
              <Field label={t('achievements.title')} htmlFor="milestone-title">
                <Input id="milestone-title" value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus />
              </Field>
              <Field label={t('achievements.type')} htmlFor="milestone-type">
                <Select id="milestone-type" value={type} disabled={editing} onChange={(event) => setType(event.target.value)}>
                  {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('achievements.target')} htmlFor="milestone-target"><Input id="milestone-target" type="number" min={1} value={targetValue} onChange={(event) => setTargetValue(event.target.value)} required /></Field>
                <Field label={t('achievements.dailyLimit')} htmlFor="milestone-threshold"><Input id="milestone-threshold" type="number" min={1} value={dailyThreshold} onChange={(event) => setDailyThreshold(event.target.value)} /></Field>
                <Field label={t('achievements.startDate')} htmlFor="milestone-start"><Input id="milestone-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></Field>
                <Field label={t('achievements.end')} htmlFor="milestone-end"><Input id="milestone-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setView(editing ? 'inProgress' : 'overview')}>{t('common.cancel')}</Button>
                <Button type="submit" loading={busy === (editing ? `edit:${editingMilestoneId}` : 'create')}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {editing ? t('achievements.saveChanges') : t('achievements.create')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryTile icon={Target} label={t('achievements.activeGoals')} value={activeMilestones.length} />
        <SummaryTile icon={Check} label={t('achievements.achievements')} value={`${unlockedAchievements.length}/${achievements.length}`} />
        <SummaryTile icon={Trophy} label={t('achievements.badges')} value={unlockedBadges.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(25rem,0.8fr)]">
        <div className="space-y-5">
          {nextMilestone ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
              <CardTitle>{t('achievements.nearestProgress')}</CardTitle>
                  <CardDescription>{nextMilestone.title}</CardDescription>
                </div>
                <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', statusClass(nextMilestone.status))}>
                  {statusLabels[nextMilestone.status] ?? nextMilestone.status}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={Math.min(nextMilestone.percent, 100)} max={100} label={`${nextMilestone.percent}%`} />
                <p className="text-sm text-muted-foreground">
                  {metric(nextMilestone.currentValue)} {t('achievements.from')} {metric(nextMilestone.targetValue)} {nextMilestone.unit ?? ''}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t('achievements.smartSuggestions')}</CardTitle>
              <CardDescription>{t('achievements.chooseSuggestion')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {suggestions.map((suggestion) => (
                <div key={`${suggestion.type}:${suggestion.title}`} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-medium">{suggestion.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{suggestion.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        run(
                          `suggest:${suggestion.type}:${suggestion.title}`,
                          () => api.post('/api/milestones', milestonePayload(suggestion)),
                          t('achievements.milestoneCreated'),
                        )
                      }
                      loading={busy === `suggest:${suggestion.type}:${suggestion.title}`}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {t('achievements.start')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => applySuggestion(suggestion)}>
                      {t('common.edit')}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <MilestoneNavCard
              icon={Target}
              title={t('achievements.inProgress')}
              description={t('achievements.inProgressDescription')}
              count={inProgressMilestones.length}
              onClick={() => setView('inProgress')}
            />
            <MilestoneNavCard
              icon={History}
              title={t('achievements.history')}
              description={t('achievements.historyDescription')}
              count={milestoneHistory.length}
              onClick={() => setView('history')}
            />
          </div>

          <Card id="milestones" className="hidden">
            <CardHeader>
              <CardTitle>{t('achievements.milestones')}</CardTitle>
              <CardDescription>{t('achievements.milestonesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {milestones.length === 0 ? (
                <EmptyState text={t('achievements.noMilestones')} />
              ) : (
                milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    id={`milestone-${milestone.id}`}
                    className="scroll-mt-28 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{milestone.title}</p>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', statusClass(milestone.status))}>
                            {statusLabels[milestone.status] ?? milestone.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {metric(milestone.currentValue)} / {metric(milestone.targetValue)} {milestone.unit ?? ''}
                          {milestone.endDate ? ` · ${t('achievements.until')} ${milestone.endDate}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {milestone.status === 'ACTIVE' ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title={t('achievements.pause')}
                            onClick={() =>
                              run(`pause:${milestone.id}`, () =>
                                api.post(`/api/milestones/${milestone.id}/pause`),
                              )
                            }
                          >
                            <Pause className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                        {milestone.status === 'PAUSED' ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title={t('achievements.resume')}
                            onClick={() =>
                              run(`resume:${milestone.id}`, () =>
                                api.post(`/api/milestones/${milestone.id}/resume`),
                              )
                            }
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                        {!['COMPLETED', 'CANCELLED'].includes(milestone.status) ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title={t('achievements.cancelGoal')}
                            onClick={() =>
                              run(`cancel:${milestone.id}`, () =>
                                api.post(`/api/milestones/${milestone.id}/cancel`),
                              )
                            }
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3">
                      <Progress value={Math.min(milestone.percent, 100)} max={100} label={`${milestone.percent}%`} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>{t('achievements.createMilestone')}</CardTitle>
              <CardDescription>{t('achievements.customMilestoneDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" block onClick={createMilestone}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('achievements.createMilestone')}
              </Button>
            </CardContent>
          </Card>

          <Card className="hidden">
            <CardHeader>
              <CardTitle>{t('achievements.customMilestone')}</CardTitle>
              <CardDescription>{t('achievements.customMilestoneDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    'create',
                    () => api.post('/api/milestones', milestonePayload()),
                    t('achievements.milestoneCreated'),
                  );
                }}
              >
                <Field label={t('achievements.title')} htmlFor="milestone-title">
                  <Input id="milestone-title" value={title} onChange={(event) => setTitle(event.target.value)} />
                </Field>
                <Field label={t('achievements.type')} htmlFor="milestone-type">
                  <Select id="milestone-type" value={type} onChange={(event) => setType(event.target.value)}>
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('achievements.target')} htmlFor="milestone-target">
                    <Input
                      id="milestone-target"
                      type="number"
                      min={1}
                      value={targetValue}
                      onChange={(event) => setTargetValue(event.target.value)}
                    />
                  </Field>
                  <Field label={t('achievements.dailyLimit')} htmlFor="milestone-threshold">
                    <Input
                      id="milestone-threshold"
                      type="number"
                      min={1}
                      value={dailyThreshold}
                      onChange={(event) => setDailyThreshold(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label={t('achievements.end')} htmlFor="milestone-end">
                  <Input
                    id="milestone-end"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </Field>
                <Button type="submit" loading={busy === 'create'} block>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('achievements.create')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card id="achievements">
            <CardHeader>
              <CardTitle>{t('achievements.achievements')}</CardTitle>
              <CardDescription>{unlockedAchievements.length} {t('achievements.unlocked')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {achievements.slice(0, 8).map((achievement) => (
                <div key={achievement.code} className="flex gap-2 text-sm">
                  <BadgeIcon
                    iconKey={achievement.icon}
                    tier={badges.find((badge) => badge.code === achievement.badgeCode)?.tier}
                    unlocked={achievement.unlocked}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium">{localizeAchievement(achievement, english).name}</p>
                    <p className="text-xs text-muted-foreground">{localizeAchievement(achievement, english).description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="badges">
            <CardHeader>
              <CardTitle>{t('achievements.badges')}</CardTitle>
              <CardDescription>{unlockedBadges.length} {t('achievements.earned')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {badges.slice(0, 8).map((badge) => (
                <div
                  key={badge.code}
                  className={cn(
                    'rounded-lg border p-2 text-sm',
                    badge.unlocked ? 'border-primary/25 bg-primary/10' : 'border-border',
                  )}
                >
                  <BadgeIcon iconKey={badge.iconKey} tier={badge.tier} unlocked={badge.unlocked} size="sm" className="mb-2" />
                  <p className="font-medium">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.tier}</p>
                </div>
              ))}
            </CardContent>
          </Card>

        </aside>
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden={true} />
        </span>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MilestoneScreenHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Button type="button" size="icon" variant="outline" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function MilestoneNavCard({
  icon: Icon,
  title,
  description,
  count,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card className="h-full transition-colors group-hover:border-primary/35">
        <CardContent className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden={true} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">{title}</span>
              <span className="text-xl font-semibold tabular-nums">{count}</span>
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </CardContent>
      </Card>
    </button>
  );
}

function MilestoneRow({ milestone, children }: { milestone: Milestone; children?: React.ReactNode }) {
  return (
    <Card id={`milestone-${milestone.id}`} className="scroll-mt-28">
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{milestone.title}</p>
              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', statusClass(milestone.status))}>
                {statusLabels[milestone.status] ?? milestone.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {metric(milestone.currentValue)} / {metric(milestone.targetValue)} {milestone.unit ?? ''}
              {milestone.endDate ? ` · ${milestone.endDate}` : ''}
            </p>
          </div>
          {children ? <div className="flex flex-wrap gap-1">{children}</div> : null}
        </div>
        <Progress value={Math.min(milestone.percent, 100)} max={100} label={`${milestone.percent}%`} />
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</p>;
}
