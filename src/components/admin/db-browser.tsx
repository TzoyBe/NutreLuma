'use client';

import * as React from 'react';
import { api, ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface FieldMeta {
  name: string;
  kind: 'scalar' | 'enum' | 'object';
  type: string;
  isList: boolean;
  isRequired: boolean;
  editable: boolean;
  sensitive: boolean;
  enumValues?: string[];
}
interface ModelSummary {
  name: string;
  delegate: string;
  count: number;
  editable: boolean;
}
interface RowsResult {
  model: string;
  pkField: string | null;
  fields: FieldMeta[];
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 25;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function AdminDbBrowser() {
  const t = useT();
  const toast = useToast();
  const [models, setModels] = React.useState<ModelSummary[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [data, setData] = React.useState<RowsResult | null>(null);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [editing, setEditing] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    api
      .get<{ models: ModelSummary[] }>('/api/admin/db/models')
      .then((res) => setModels(res.models))
      .catch((err) => {
        if (err instanceof ApiClientError) toast.push(err.message, 'error');
      });
  }, [toast]);

  const load = React.useCallback(
    async (model: string, nextPage: number, nextSearch: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(nextPage), pageSize: String(PAGE_SIZE) });
        if (nextSearch.trim()) params.set('search', nextSearch.trim());
        const res = await api.get<RowsResult>(`/api/admin/db/${model}?${params.toString()}`);
        setData(res);
      } catch (err) {
        if (err instanceof ApiClientError) toast.push(err.message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const selectModel = (model: string) => {
    setSelected(model);
    setPage(1);
    setSearch('');
    setEditing(null);
    void load(model, 1, '');
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t('admin.dbTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.dbSubtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        {/* Model list */}
        <Card>
          <CardContent className="max-h-[70vh] space-y-1 overflow-y-auto py-3">
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('admin.dbModels')}
            </p>
            {models.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => selectModel(m.name)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  selected === m.name ? 'bg-primary/15 text-primary' : 'hover:bg-muted',
                )}
              >
                <span className="truncate">{m.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{m.count}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Rows */}
        <div className="min-w-0 space-y-3">
          {!selected ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t('admin.dbSelectModel')}</CardContent></Card>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  void load(selected, 1, search);
                }}
                className="flex gap-2"
              >
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('admin.dbSearch')}
                />
                <Button type="submit" variant="secondary">{t('admin.dbSearch')}</Button>
              </form>

              {data ? (
                <>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{data.total} {t('admin.dbRows')}{data.pkField ? '' : ` · ${t('admin.dbNoPk')}`}</span>
                    <span className="tabular-nums">{data.page}/{totalPages}</span>
                  </div>

                  <div className="w-full overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-left">
                          {data.fields.map((f) => (
                            <th key={f.name} className="whitespace-nowrap px-3 py-2 font-medium">{f.name}</th>
                          ))}
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row, i) => (
                          <tr key={(row[data.pkField ?? 'id'] as string) ?? i} className="border-b border-border/60">
                            {data.fields.map((f) => (
                              <td key={f.name} className="max-w-[240px] truncate px-3 py-2" title={cellText(row[f.name])}>
                                {cellText(row[f.name])}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right">
                              {data.pkField ? (
                                <button
                                  type="button"
                                  onClick={() => setEditing(row)}
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  {t('admin.dbEdit')}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button
                      variant="secondary"
                      disabled={data.page <= 1 || loading}
                      onClick={() => { const p = data.page - 1; setPage(p); void load(selected, p, search); }}
                    >
                      {t('admin.dbPrev')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={data.page >= totalPages || loading}
                      onClick={() => { const p = data.page + 1; setPage(p); void load(selected, p, search); }}
                    >
                      {t('admin.dbNext')}
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {editing && data && selected ? (
        <RowEditor
          model={selected}
          fields={data.fields}
          pkField={data.pkField!}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(selected, page, search); }}
        />
      ) : null}
    </div>
  );
}

function RowEditor({
  model,
  fields,
  pkField,
  row,
  onClose,
  onSaved,
}: {
  model: string;
  fields: FieldMeta[];
  pkField: string;
  row: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const id = String(row[pkField]);
  const editable = fields.filter((f) => f.editable);
  const [values, setValues] = React.useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of editable) {
      const v = row[f.name];
      if (f.type === 'Boolean') init[f.name] = v === true || v === 'true';
      else if (v === null || v === undefined) init[f.name] = '';
      else if (typeof v === 'object') init[f.name] = JSON.stringify(v);
      else init[f.name] = String(v);
    }
    return init;
  });
  const [saving, setSaving] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const set = (name: string, value: string | boolean) => setValues((s) => ({ ...s, [name]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const data: Record<string, string | boolean | null> = {};
      for (const f of editable) {
        const v = values[f.name];
        data[f.name] = f.type === 'Boolean' ? Boolean(v) : v === '' ? null : (v as string);
      }
      await api.patch(`/api/admin/db/${model}/${encodeURIComponent(id)}`, { data });
      toast.push(t('admin.dbSaved'), 'success');
      onSaved();
    } catch (err) {
      if (err instanceof ApiClientError) toast.push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.delete(`/api/admin/db/${model}/${encodeURIComponent(id)}`);
      toast.push(t('admin.dbDeleted'), 'success');
      onSaved();
    } catch (err) {
      if (err instanceof ApiClientError) toast.push(err.message, 'error');
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="glass max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{model} · {id.slice(0, 12)}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-3">
          {fields.map((f) => {
            const readOnly = !f.editable;
            const label = (
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {f.name} <span className="opacity-60">· {f.type}{f.isRequired ? '' : '?'}{readOnly ? ` · ${t('admin.dbReadonly')}` : ''}</span>
              </span>
            );
            if (readOnly) {
              return (
                <label key={f.name} className="block">
                  {label}
                  <div className="truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {f.sensitive ? '••••' : cellText(row[f.name]) || '—'}
                  </div>
                </label>
              );
            }
            if (f.type === 'Boolean') {
              return (
                <label key={f.name} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
                  {f.name}
                </label>
              );
            }
            if (f.kind === 'enum') {
              return (
                <label key={f.name} className="block">
                  {label}
                  <Select value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)}>
                    <option value="">—</option>
                    {(f.enumValues ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                  </Select>
                </label>
              );
            }
            if (f.type === 'Json') {
              return (
                <label key={f.name} className="block">
                  {label}
                  <Textarea value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} />
                </label>
              );
            }
            return (
              <label key={f.name} className="block">
                {label}
                <Input value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} />
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="destructive" onClick={() => setConfirming(true)} disabled={saving}>{t('admin.dbDelete')}</Button>
          <Button onClick={save} loading={saving}>{t('admin.dbSave')}</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('admin.dbDeleteConfirm')}
        confirmLabel={t('admin.dbDelete')}
        loading={saving}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
