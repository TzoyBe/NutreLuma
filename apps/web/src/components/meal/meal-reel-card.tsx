import Link from 'next/link';
import { Utensils } from 'lucide-react';
import type { MealCardData } from './meal-card';

/**
 * Compact "film reel" κάρτα γεύματος — glass-reel εναλλακτική του MealCard
 * για οριζόντιο carousel. Edit/delete παραμένουν στη σελίδα λεπτομερειών
 * (`/meals/[id]`), εδώ είναι απλά ένα link-tile με φωτογραφία + kcal.
 */
export function MealReelCard({ meal }: { meal: MealCardData }) {
  return (
    <Link href={`/meals/${meal.id}`} className="meal-reel-card">
      {meal.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.thumbUrl} alt="" loading="lazy" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground">
          <Utensils className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <div className="meal-reel-footer">
        <p className="truncate text-xs font-semibold">{meal.title}</p>
        <p className="text-[11px] font-semibold text-accent">
          {meal.timeLabel}
          {meal.calories !== null ? ` · ${Math.round(meal.calories)} kcal` : ''}
        </p>
      </div>
    </Link>
  );
}
