import { redirect } from 'next/navigation';

/**
 * Η σελίδα μετακόμισε κάτω από το /profile. Το παλιό URL διατηρείται ως
 * ανακατεύθυνση, ώστε bookmarks και παλιοί σύνδεσμοι να συνεχίσουν να δουλεύουν.
 */
export default function LegacyRedirect(): never {
  redirect('/profile/billing');
}
