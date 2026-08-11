import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, BarChart3, Sparkles, ChevronRight } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { Card, CardContent } from '@/components/ui/card';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('progress.title') };
}

export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const t = await getT();
  await requirePageUser();

  const items = [
    { href: '/history', title: t('progress.history'), desc: t('progress.historyDesc'), Icon: CalendarDays },
    { href: '/stats', title: t('progress.stats'), desc: t('progress.statsDesc'), Icon: BarChart3 },
    { href: '/insights', title: t('progress.insights'), desc: t('progress.insightsDesc'), Icon: Sparkles },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t('progress.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('progress.subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ href, title, desc, Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-4 py-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  <p className="truncate text-sm text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
