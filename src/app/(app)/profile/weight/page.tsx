import { redirect } from 'next/navigation';

/**
 * Το βάρος έφυγε από το μενού προφίλ και ζει πλέον ως αυτόνομη σελίδα στο
 * /weight (προσβάσιμη από το κουμπί του dashboard). Το παλιό URL διατηρείται
 * ως ανακατεύθυνση, ώστε bookmarks και παλιοί σύνδεσμοι να δουλεύουν.
 */
export default function LegacyProfileWeightRedirect(): never {
  redirect('/weight');
}
