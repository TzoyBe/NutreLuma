import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Επιφάνεια «liquid glass».
 *
 * Οι αποστάσεις ορίζονται ΕΔΩ και μόνο εδώ, ώστε κάθε κάρτα της εφαρμογής να
 * έχει ακριβώς την ίδια εσωτερική γεωμετρία. Οι σελίδες δεν πρέπει να
 * περνούν δικά τους paddings.
 *
 * Το `solid` επιστρέφει σε αδιαφανή κάρτα όπου η διαφάνεια θα έβλαπτε την
 * αναγνωσιμότητα (π.χ. μεγάλα κείμενα όρων χρήσης).
 */
export function Card({
  className,
  solid = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { solid?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[--radius] text-card-foreground',
        solid
          ? 'border border-border bg-card/95 shadow-[0_10px_28px_-24px_hsl(var(--glass-shadow)/0.5)]'
          : 'glass glass-specular',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1 p-5 pb-3 sm:p-6 sm:pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-base font-semibold leading-snug text-foreground', className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

/**
 * Το `pt-0` ισχύει μόνο όταν προηγείται CardHeader. Το `:first-child` το κάνει
 * αυτόματα, ώστε καμία σελίδα να μη χρειάζεται να θυμάται `pt-5`.
 */
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0 sm:p-6 sm:pt-0 [&:first-child]:pt-5 sm:[&:first-child]:pt-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
}
