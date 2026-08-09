'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { weightEntrySchema } from '@/lib/validation/weight';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input, Textarea } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, StatTile } from '@/components/ui/misc';
import { LineChart } from '@/components/charts';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

export interface WeightEntryItem {
  id: string;
  weightKg: number;
  entryDate: string;
  notes: string | null;
}

export function WeightPanel({
  entries,
  todayISO,
  targetWeightKg,
}: {
  entries: WeightEntryItem[];
  todayISO: string;
  targetWeightKg: number | null;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [weight, setWeight] = React.useState('');
  const [date, setDate] = React.useState(todayISO);
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const sorted = React.useMemo(
    () => [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    [entries],
  );
  const current = sorted.at(-1)?.weightKg ?? null;
  const first = sorted[0]?.weightKg ?? null;
  const change = current !== null && first !== null ? Number((current - first).toFixed(1)) : null;
  const duplicate = entries.some((entry) => entry.entryDate === date);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setErrors({});

    const parsed = weightEntrySchema.safeParse({ weightKg: weight, entryDate: date, notes });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/weight', parsed.data);
      toast.push(t('toast.weightSaved'), 'success');
      setWeight('');
      setNotes('');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrors(error.fieldErrors());
        toast.push(error.message, 'error');
      } else {
        toast.push(t('errors.generic'), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/api/weight/${id}`);
      toast.push(t('toast.weightDeleted'), 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t('weight.current')} value={current ?? '—'} suffix={current ? 'kg' : undefined} />
        <StatTile
          label={t('weight.target')}
          value={targetWeightKg ?? '—'}
          suffix={targetWeightKg ? 'kg' : undefined}
        />
        <StatTile
          label={t('weight.change')}
          value={change === null ? '—' : `${change > 0 ? '+' : ''}${change}`}
          suffix={change === null ? undefined : 'kg'}
          tone={change !== null && change > 0 ? 'danger' : 'primary'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('weight.addEntry')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('weight.weightKg')} htmlFor="weightKg" error={errors.weightKg} required>
                <Input
                  {...fieldAria('weightKg', errors.weightKg)}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="25"
                  max="400"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                />
              </Field>
              <Field
                label={t('weight.date')}
                htmlFor="entryDate"
                error={errors.entryDate}
                hint={duplicate ? t('weight.duplicate') : undefined}
                required
              >
                <Input
                  {...fieldAria('entryDate', errors.entryDate)}
                  type="date"
                  value={date}
                  max={todayISO}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label={t('weight.notes')} htmlFor="notes" error={errors.notes}>
              <Textarea
                {...fieldAria('notes', errors.notes)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
              />
            </Field>
            <Button type="submit" loading={saving} block>
              {t('common.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {sorted.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('weight.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              ariaLabel={t('weight.title')}
              data={sorted.map((entry) => ({ label: entry.entryDate, value: entry.weightKg }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState title={t('weight.empty')} />
      ) : (
        <ul className="space-y-2">
          {[...entries]
            .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
            .map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">{entry.weightKg} kg</p>
                  <p className="text-sm text-muted-foreground">
                    {entry.entryDate}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(entry.id)}
                  aria-label={`${t('common.delete')} ${entry.entryDate}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('weight.deleteConfirm')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
