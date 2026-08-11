'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

const controlClasses =
  'liquid-control w-full rounded-2xl px-3 py-2 text-base font-medium text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

function isCalendarInput(
  type: React.InputHTMLAttributes<HTMLInputElement>['type'],
): type is 'date' | 'datetime-local' {
  return type === 'date' || type === 'datetime-local';
}

function detectNativeApp() {
  if (typeof window === 'undefined') return false;
  const maybeCapacitor = window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  return Boolean(maybeCapacitor.Capacitor?.isNativePlatform?.());
}

function formatCalendarValue(type: 'date' | 'datetime-local', value: string) {
  if (!value) return '';

  const parsed =
    type === 'date'
      ? new Date(`${value}T00:00:00`)
      : new Date(value.includes('T') ? value : value.replace(' ', 'T'));

  if (Number.isNaN(parsed.getTime())) return value;

  const locale =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-GB';

  if (type === 'date') {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, placeholder, value, disabled, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isNativeApp, setIsNativeApp] = React.useState(false);

    React.useEffect(() => {
      setIsNativeApp(detectNativeApp());
    }, []);

    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement, []);

    if (isCalendarInput(type) && isNativeApp) {
      const displayValue =
        typeof value === 'string' ? formatCalendarValue(type, value) : String(value ?? '');

      return (
        <div
          className={cn(
            controlClasses,
            'relative flex h-11 min-w-0 max-w-full items-center overflow-hidden pr-11 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
            className,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'block min-w-0 flex-1 truncate whitespace-nowrap tabular-nums',
              !displayValue && 'text-muted-foreground',
            )}
          >
            {displayValue || placeholder || ''}
          </span>

          <CalendarDays
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />

          <input
            ref={inputRef}
            type={type}
            value={value}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            placeholder={placeholder}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        ref={inputRef}
        type={type}
        className={cn(
          controlClasses,
          'h-11 min-w-0 max-w-full overflow-hidden',
          isCalendarInput(type) && 'liquid-date-input tabular-nums',
          className,
        )}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(controlClasses, 'min-h-[88px] resize-y', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      controlClasses,
      'liquid-select h-11 appearance-none pr-11',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, children, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-semibold text-foreground', className)} {...props}>
    {children}
  </label>
));
Label.displayName = 'Label';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function fieldAria(id: string, error?: string) {
  return {
    id,
    name: id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  } as const;
}
