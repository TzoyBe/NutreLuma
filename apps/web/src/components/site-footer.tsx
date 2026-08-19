import { JOYBEE, JoybeeAttribution } from '@/components/brand/joybee';

/** Κοινό footer με απόδοση στη Joybee Digital + copyright. */
export function SiteFooter({ labels }: { labels: { partOf: string; productOf: string } }) {
  return (
    <footer className="mt-6 border-t border-border/60 py-6">
      <div className="container flex flex-col items-center gap-1.5 text-center">
        <JoybeeAttribution prefix={labels.partOf} />
        <p className="text-xs text-muted-foreground">{labels.productOf}</p>
        <p className="text-xs text-muted-foreground">{JOYBEE.copyright}</p>
      </div>
    </footer>
  );
}
