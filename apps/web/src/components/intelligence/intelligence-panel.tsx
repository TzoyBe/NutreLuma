'use client';

import * as React from 'react';
import { BrainCircuit, RotateCcw, ShieldCheck } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

type Settings = { personalCalibration: boolean; useMealHistory: boolean; useWeightHistory: boolean; useBehaviorPatterns: boolean };

export function IntelligenceSettings({ initial }: { initial: Settings }) {
  const [settings, setSettings] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const toast = useToast();
  const t = useT();
  async function toggle(key: keyof Settings) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next); setSaving(true);
    try { await api.put('/api/intelligence', next); toast.push(t('insights.saved'), 'success'); }
    catch (error) { setSettings(settings); toast.push(error instanceof ApiClientError ? error.message : t('insights.saveFailed'), 'error'); }
    finally { setSaving(false); }
  }
  async function reset() {
    setSaving(true);
    try { await api.delete('/api/intelligence'); setSettings({ ...settings, personalCalibration: false }); toast.push(t('insights.resetDone'), 'success'); }
    catch (error) { toast.push(error instanceof ApiClientError ? error.message : t('insights.resetFailed'), 'error'); }
    finally { setSaving(false); }
  }
  const rows: Array<[keyof Settings, string, string]> = [
    ['personalCalibration', t('insights.personalCalibration'), t('insights.personalCalibrationBody')],
    ['useMealHistory', t('insights.useMealHistory'), t('insights.useMealHistoryBody')],
    ['useWeightHistory', t('insights.useWeightHistory'), t('insights.useWeightHistoryBody')],
    ['useBehaviorPatterns', t('insights.useBehaviorPatterns'), t('insights.useBehaviorPatternsBody')],
  ];
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" aria-hidden="true" />{t('insights.learningTitle')}</CardTitle><CardDescription>{t('insights.learningDescription')}</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      {rows.map(([key, title, body]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
        <input type="checkbox" checked={settings[key]} disabled={saving} onChange={() => void toggle(key)} className="mt-1 h-4 w-4 accent-primary" />
        <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{body}</span></span>
      </label>)}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('insights.privateHistory')}</span><Button type="button" variant="outline" onClick={() => void reset()} loading={saving}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('insights.reset')}</Button></div>
    </CardContent>
  </Card>;
}
