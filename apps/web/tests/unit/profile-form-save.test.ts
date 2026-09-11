import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  apiPut: vi.fn(),
  onProfileSaveSuccess: null as null | (() => void),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useContext: () => fakes.onProfileSaveSuccess,
    useMemo: (factory: () => unknown) => factory(),
    useState: <T>(initial: T | (() => T)) => [
      typeof initial === 'function' ? (initial as () => T)() : initial,
      vi.fn(),
    ],
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/components/toast', () => ({
  useToast: () => ({ push: vi.fn() }),
}));

vi.mock('@/i18n/client', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/lib/api-client', () => ({
  api: { put: fakes.apiPut },
  ApiClientError: class ApiClientError extends Error {
    fieldErrors() { return {}; }
  },
}));

const { ProfileForm } = await import('@/components/forms/profile-form');

const validProfile = {
  birthDate: '1995-01-01',
  gender: 'FEMALE' as const,
  heightCm: '169',
  currentWeightKg: '64',
  targetWeightKg: '61',
  activityLevel: 'MODERATE' as const,
  goal: 'LOSE' as const,
  dailyCalorieTarget: '1900',
  preferredUnits: 'METRIC' as const,
  timezone: 'Europe/Athens',
};

async function submitProfile() {
  const form = ProfileForm({ initial: validProfile });
  await form.props.onSubmit({ preventDefault() {} } as never);
}

beforeEach(() => {
  fakes.apiPut.mockReset();
  fakes.onProfileSaveSuccess = null;
});

describe('ProfileForm profile-tab save boundary', () => {
  it('still completes a successful save without a profile-tab boundary', async () => {
    fakes.apiPut.mockResolvedValue({});

    await expect(submitProfile()).resolves.toBeUndefined();
  });

  it('collapses the profile editor after the profile update succeeds', async () => {
    let editorOpen = true;
    fakes.onProfileSaveSuccess = () => { editorOpen = false; };
    fakes.apiPut.mockResolvedValue({});

    await submitProfile();

    expect(editorOpen).toBe(false);
  });

  it('keeps the profile editor open when the profile update fails', async () => {
    let editorOpen = true;
    fakes.onProfileSaveSuccess = () => { editorOpen = false; };
    fakes.apiPut.mockRejectedValue(new Error('offline'));

    await submitProfile();

    expect(editorOpen).toBe(true);
  });
});
