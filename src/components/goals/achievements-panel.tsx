'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  ChevronRight,
  Droplets,
  Footprints,
  Pause,
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
type Notification = {
  id: string;
  type: 'ACHIEVEMENT_UNLOCKED' | 'BADGE_UNLOCKED' | string;
  title: string;
  body: string;
  dedupeKey: string | null;
  readAt: string | null;
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

function notificationUnlockKey(notification: Notification, achievements: Achievement[]): string {
  if (notification.type === 'BADGE_UNLOCKED') {
    const badgeCode = notification.dedupeKey?.startsWith('badge:') ? notification.dedupeKey.slice('badge:'.length) : '';
    return badgeCode ? `unlock:${badgeCode}` : `notification:${notification.id}`;
  }

  if (notification.type === 'ACHIEVEMENT_UNLOCKED') {
    const achievementCode = notification.dedupeKey?.startsWith('achievement:')
      ? notification.dedupeKey.slice('achievement:'.length)
      : '';
    const achievement = achievements.find((item) => item.code === achievementCode);
    return achievement?.badgeCode ? `unlock:${achievement.badgeCode}` : `notification:${notification.id}`;
  }

  return `notification:${notification.id}`;
}

function getNotificationBadge(notification: Notification, achievements: Achievement[], badges: Badge[]) {
  if (notification.type === 'BADGE_UNLOCKED') {
    const badgeCode = notification.dedupeKey?.startsWith('badge:') ? notification.dedupeKey.slice('badge:'.length) : '';
    return badges.find((badge) => badge.code === badgeCode);
  }

  if (notification.type === 'ACHIEVEMENT_UNLOCKED') {
    const achievementCode = notification.dedupeKey?.startsWith('achievement:')
      ? notification.dedupeKey.slice('achievement:'.length)
      : '';
    const achievement = achievements.find((item) => item.code === achievementCode);
    return achievement ? badges.find((badge) => badge.code === achievement.badgeCode) : undefined;
  }

  return undefined;
}

export function AchievementsPanel({
  milestones,
  achievements,
  badges,
  notifications,
  suggestions,
  today,
}: {
  milestones: Milestone[];
  achievements: Achievement[];
  badges: Badge[];
  notifications: Notification[];
  suggestions: Suggestion[];
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const english = t('achievements.achievements') === 'Achievements';
  const [busy, setBusy] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState('MEAL_LOGGING_DAYS');
  const [targetValue, setTargetValue] = React.useState('5');
  const [dailyThreshold, setDailyThreshold] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [waterMl, setWaterMl] = React.useState('250');
  const [steps, setSteps] = React.useState('');
  const [durationMin, setDurationMin] = React.useState('');
  const [readNotificationIds, setReadNotificationIds] = React.useState<string[]>([]);

  const activeMilestones = milestones.filter((milestone) => milestone.status === 'ACTIVE');
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);
  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const visibleNotifications = notifications.map((notification) =>
    readNotificationIds.includes(notification.id)
      ? { ...notification, readAt: notification.readAt ?? new Date().toISOString() }
      : notification,
  );
  const dedupedNotifications = visibleNotifications.filter((notification, index, all) => {
    const key = notificationUnlockKey(notification, achievements);
    return all.findIndex((candidate) => notificationUnlockKey(candidate, achievements) === key) === index;
  });
  const unreadNotifications = dedupedNotifications.filter((notification) => !notification.readAt);
  const nextMilestone = activeMilestones
    .slice()
    .sort((a, b) => b.percent - a.percent)[0];

  async function run(key: string, action: () => Promise<unknown>, success?: string) {
    if (busy) return;
    setBusy(key);
    try {
      await action();
      if (success) toast.push(success, 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('achievements.somethingWentWrong'), 'error');
    } finally {
      setBusy(null);
    }
  }

  function milestonePayload(source?: Suggestion) {
    return {
      title: source?.title ?? title,
      type: source?.type ?? type,
      targetValue: source?.targetValue ?? Number(targetValue),
      startDate: today,
      endDate: source?.endDate ?? (endDate || undefined),
      dailyThreshold:
        source?.dailyThreshold ?? (dailyThreshold ? Number(dailyThreshold) : undefined),
    };
  }

  function applySuggestion(suggestion: Suggestion) {
    setTitle(suggestion.title);
    setType(suggestion.type);
    setTargetValue(String(suggestion.targetValue));
    setDailyThreshold(suggestion.dailyThreshold ? String(suggestion.dailyThreshold) : '');
    setEndDate(suggestion.endDate);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryTile icon={Target} label={t('achievements.activeGoals')} value={activeMilestones.length} />
        <SummaryTile icon={Check} label={t('achievements.achievements')} value={`${unlockedAchievements.length}/${achievements.length}`} />
        <SummaryTile icon={Trophy} label={t('achievements.badges')} value={unlockedBadges.length} />
        <SummaryTile icon={Bell} label={t('achievements.new')} value={unreadNotifications.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(25rem,0.8fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('achievements.today')}</CardTitle>
              <CardDescription>{t('achievements.quickLog')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <form
                className="rounded-lg border border-border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    'water',
                    () => api.post('/api/water', { entryDate: today, volumeMl: Number(waterMl) }),
                    t('achievements.loggedWater'),
                  );
                }}
              >
                <div className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="font-medium">{t('achievements.water')}</p>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    aria-label={t('achievements.waterMl')}
                    type="number"
                    min={1}
                    value={waterMl}
                    onChange={(event) => setWaterMl(event.target.value)}
                  />
                  <Button type="submit" loading={busy === 'water'}>
                    {t('common.save')}
                  </Button>
                </div>
                <div className="mt-2 flex gap-2">
                  {[250, 500, 750].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
                      onClick={() => setWaterMl(String(amount))}
                    >
                      {amount} ml
                    </button>
                  ))}
                </div>
              </form>

              <form
                className="rounded-lg border border-border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    'activity',
                    () =>
                      api.post('/api/activity', {
                        entryDate: today,
                        kind: 'WALK',
                        steps: steps ? Number(steps) : undefined,
                        durationMin: durationMin ? Number(durationMin) : undefined,
                      }),
                    t('achievements.loggedActivity'),
                  );
                }}
              >
                <div className="flex items-center gap-2">
                  <Footprints className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="font-medium">{t('achievements.walking')}</p>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    aria-label={t('achievements.steps')}
                    type="number"
                    min={0}
                    placeholder={t('achievements.steps')}
                    value={steps}
                    onChange={(event) => setSteps(event.target.value)}
                  />
                  <Input
                    aria-label={t('achievements.minutes')}
                    type="number"
                    min={0}
                    placeholder={t('achievements.minutes')}
                    value={durationMin}
                    onChange={(event) => setDurationMin(event.target.value)}
                  />
                  <Button type="submit" loading={busy === 'activity'}>
                    {t('common.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>{t('achievements.milestones')}</CardTitle>
              <CardDescription>{t('achievements.milestonesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {milestones.length === 0 ? (
                <EmptyState text={t('achievements.noMilestones')} />
              ) : (
                milestones.map((milestone) => (
                  <div key={milestone.id} className="rounded-lg border border-border p-3">
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
                            title="Pause"
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
                            title="Resume"
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
                            title="Cancel"
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
          <Card>
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

          <Card>
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

          <Card>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
              <CardTitle>{t('achievements.notifications')}</CardTitle>
                <CardDescription>{unreadNotifications.length} {t('achievements.new')}</CardDescription>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title={t('achievements.markRead')}
                onClick={() =>
                  run('read', async () => {
                    await api.post('/api/notifications/read');
                    setReadNotificationIds(visibleNotifications.map((notification) => notification.id));
                  })
                }
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {dedupedNotifications.length === 0 ? (
                <EmptyState text={t('achievements.noNotifications')} />
              ) : (
                dedupedNotifications.slice(0, 6).map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex gap-2 rounded-lg border p-2 text-sm',
                      notification.readAt ? 'border-border' : 'border-primary/25 bg-primary/10',
                    )}
                  >
                    <BadgeIcon
                      iconKey={getNotificationBadge(notification, achievements, badges)?.iconKey}
                      tier={getNotificationBadge(notification, achievements, badges)?.tier}
                      unlocked={notification.type === 'ACHIEVEMENT_UNLOCKED' || notification.type === 'BADGE_UNLOCKED'}
                      size="sm"
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">{notification.body}</p>
                    </div>
                  </div>
                ))
              )}
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

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</p>;
}
