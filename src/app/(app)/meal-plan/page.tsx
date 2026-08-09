import { redirect } from 'next/navigation';

/** Ενοποιήθηκε με τις Συνταγές — ο generator ζει τώρα στο /recipes. */
export default function MealPlanPage() {
  redirect('/recipes');
}
