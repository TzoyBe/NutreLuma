import { cn } from '@/lib/utils';

/** Στοιχεία της μητρικής εταιρίας. */
export const JOYBEE = {
  name: 'Joybee Digital',
  tagline: 'Smart apps. Real impact.',
  url: 'https://joybeedigital.com',
  copyright: '© 2026 Joybee Digital',
};

/** Λεκτικό λογότυπο «joybee DIGITAL» (brand text lockup, χωρίς asset). */
export function JoybeeWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-sm font-semibold lowercase tracking-tight text-foreground', className)}>
      joybee
      <span className="ml-1 text-[0.62em] font-semibold uppercase tracking-[0.22em] text-accent">
        Digital
      </span>
    </span>
  );
}

/** «Part of joybee DIGITAL» — σύνδεσμος προς το joybeedigital.com. */
export function JoybeeAttribution({
  prefix,
  className,
}: {
  prefix: string;
  className?: string;
}) {
  return (
    <a
      href={JOYBEE.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <span>{prefix}</span>
      <JoybeeWordmark />
    </a>
  );
}
