import Link from 'next/link';
import { Camera } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function AddMealHero({
  title,
  subtitle,
  manualLabel,
}: {
  title: string;
  subtitle: string;
  manualLabel: string;
}) {
  return (
    <Card className="add-meal-hero universe-app-hero universe-app-reveal overflow-hidden">
      <div className="universe-app-orbit" aria-hidden="true" />
      <CardContent className="flex flex-col items-center gap-1 py-8 text-center">
        <Link
          href="/meals/new"
          aria-label={title}
          className="add-meal-shutter mb-4 flex h-24 w-24 items-center justify-center rounded-full text-primary-foreground transition-transform hover:scale-[1.03]"
        >
          <Camera className="h-9 w-9" aria-hidden="true" />
        </Link>
        <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
        <p className="max-w-xs text-sm text-muted-foreground">{subtitle}</p>
        <Link
          href="/meals/manual"
          className="mt-3 text-sm font-semibold text-muted-foreground underline decoration-1 underline-offset-4 hover:text-foreground"
        >
          {manualLabel}
        </Link>
      </CardContent>
    </Card>
  );
}
