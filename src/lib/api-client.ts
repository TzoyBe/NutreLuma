'use client';

import { DEFAULT_LOCALE, t as translate, type Locale, type TranslationKey } from '@/i18n';

/**
 * Το api-client δεν είναι component, οπότε δεν μπορεί να χρησιμοποιήσει hook.
 * Διαβάζει τη γλώσσα απευθείας από το cookie — μόνο για τα δύο fallback
 * μηνύματα σφάλματος, όταν ο server δεν πρόλαβε να απαντήσει με δικό του.
 */
function currentLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  return DEFAULT_LOCALE;
}

const t = (key: TranslationKey) => translate(key, currentLocale());

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Χαρτογράφηση των details του Zod σε {field: message}. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const issue of this.details as Array<{ path?: string; message?: string }>) {
        if (issue.path && issue.message && !out[issue.path]) out[issue.path] = issue.message;
      }
    }
    return out;
  }
}

async function handle<T>(response: Response): Promise<T> {
  let payload: ApiSuccess<T> | ApiFailure | null = null;
  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
  } catch {
    throw new ApiClientError('INTERNAL_ERROR', t('errors.generic'), response.status);
  }

  if (!response.ok || !payload || payload.ok === false) {
    const failure = payload as ApiFailure | null;
    throw new ApiClientError(
      failure?.error.code ?? 'INTERNAL_ERROR',
      failure?.error.message ?? t('errors.generic'),
      response.status,
      failure?.error.details,
    );
  }
  return payload.data;
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  credentials: 'same-origin',
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiClientError('NETWORK_ERROR', t('errors.network'), 0);
  }
  return handle<T>(response);
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: 'GET', credentials: 'same-origin' }),
  post: <T>(url: string, body?: unknown) => request<T>(url, jsonInit('POST', body)),
  put: <T>(url: string, body?: unknown) => request<T>(url, jsonInit('PUT', body)),
  patch: <T>(url: string, body?: unknown) => request<T>(url, jsonInit('PATCH', body)),
  delete: <T>(url: string, body?: unknown) => request<T>(url, jsonInit('DELETE', body)),
  upload: <T>(url: string, form: FormData) =>
    request<T>(url, { method: 'POST', body: form, credentials: 'same-origin' }),
};
