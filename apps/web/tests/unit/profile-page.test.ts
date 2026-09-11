import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileAccountPage from '@/app/(app)/profile/page';
import { ProfileUniverse } from '@/components/profile/profile-universe';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { ProfileForm } from '@/components/forms/profile-form';
import { DangerZonePanel } from '@/components/settings/account-panels';

const fixtures = vi.hoisted(() => ({
  profile: {
    id: 'profile-ada', firstName: 'Ada', lastName: 'Lovelace', birthDate: '1995-01-01',
    gender: 'FEMALE', heightCm: 169, currentWeightKg: 64, targetWeightKg: 61,
    activityLevel: 'MODERATE', goal: 'LOSE', dailyCalorieTarget: 1800,
    suggestedDailyCalorieTarget: 1900, effectiveDailyCalorieTarget: 1900,
    preferredUnits: 'METRIC', timezone: 'Europe/Athens',
  },
  googleIdentity: null as { id: string } | null,
}));

vi.mock('@/server/auth/guards', () => ({ requirePageUser: async () => ({
  id: 'ada', displayName: 'Ada Lovelace', email: 'ada@example.com', role: 'USER', consentAcceptedAt: new Date('2026-01-01'),
}) }));
vi.mock('@/server/services/profile', () => ({ getProfile: async () => fixtures.profile }));
vi.mock('@/server/db/prisma', () => ({ prisma: {
  authIdentity: { findFirst: async () => fixtures.googleIdentity },
  subscription: { findUnique: async () => ({
    status: 'TRIALING', provider: null, accessUntil: new Date('2026-10-01'), autoRenew: false,
  }) },
  personalIntelligenceSettings: { upsert: async () => ({
    userId: 'ada', personalCalibration: true, useMealHistory: true, useWeightHistory: true,
    useBehaviorPatterns: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  }) },
} }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'en' }) }) }));

function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === type) return child as ReactElement<Record<string, unknown>>;
    const match = findElement(child.props.children, type);
    if (match) return match;
  }
}

afterEach(() => { vi.useRealTimers(); fixtures.googleIdentity = null; });

describe('ProfileAccountPage', () => {
  it('builds the hero from effective targets and subscription state while retaining editable saved values', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T12:00:00Z'));
    const page = await ProfileAccountPage();
    expect(findElement(page, ProfileUniverse)?.props.model).toMatchObject({
      displayName: 'Ada Lovelace', dailyTarget: '1900', age: '31', bmi: '22.4', planStatus: 'Trial',
    });
    const tabs = findElement(page, ProfileTabs)!;
    expect(findElement(tabs.props.profileEditor as ReactNode, ProfileForm)?.props.initial).toMatchObject({
      dailyCalorieTarget: '1800', currentWeightKg: '64', targetWeightKg: '61', activityLevel: 'MODERATE',
    });
  });

  it.each([null, { id: 'google-ada' }])('retains the deletion password requirement for identity %j', async (identity) => {
    fixtures.googleIdentity = identity;
    const tabs = findElement(await ProfileAccountPage(), ProfileTabs)!;
    expect(findElement(tabs.props.account as ReactNode, DangerZonePanel)?.props.passwordRequired).toBe(identity === null);
  });
});
