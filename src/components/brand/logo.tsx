import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Λογότυπο NutreLuma.
 *
 * Ιδέα: ένα διάφραγμα φακού (vision) του οποίου τα πτερύγια σχηματίζουν φύλλο
 * (nutrition). Το κενό στο κέντρο λειτουργεί ταυτόχρονα ως κόρη φακού και ως
 * σπόρος. Καθαρά γεωμετρικό, ώστε να διαβάζεται και στα 16 px του favicon.
 *
 * Χρησιμοποιεί `currentColor` για το μονόχρωμο variant και gradient για το
 * κανονικό, οπότε δουλεύει σε light και dark χωρίς δεύτερο αρχείο.
 */
export function LogoMark({
  className,
  monochrome = false,
  title,
}: {
  className?: string;
  monochrome?: boolean;
  title?: string;
}) {
  const gradientId = React.useId();
  const fill = monochrome ? 'currentColor' : `url(#${gradientId})`;

  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-8 w-8', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {monochrome ? null : (
        <defs>
          <linearGradient id={gradientId} x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34D399" />
            <stop offset="0.55" stopColor="#0F7A63" />
            <stop offset="1" stopColor="#0B5B57" />
          </linearGradient>
        </defs>
      )}

      {/* Εξωτερικός δακτύλιος — το «σώμα» του φακού */}
      <circle cx="24" cy="24" r="21" stroke={fill} strokeWidth="2.5" opacity="0.35" />

      {/*
        Τέσσερα πτερύγια διαφράγματος. Κάθε πτερύγιο είναι φύλλο: δύο τόξα που
        συναντιούνται σε αιχμή. Περιστρέφονται ανά 90° γύρω από το κέντρο.
      */}
      {[0, 90, 180, 270].map((angle) => (
        <path
          key={angle}
          d="M24 8 C31.5 12 36 17 36 24 C29 24 24 19.5 24 8 Z"
          fill={fill}
          opacity={angle % 180 === 0 ? 0.95 : 0.7}
          transform={`rotate(${angle} 24 24)`}
        />
      ))}

      {/* Κόρη / σπόρος */}
      <circle cx="24" cy="24" r="4.2" fill={fill} />
      <circle cx="22.4" cy="22.4" r="1.5" fill="#FFFFFF" opacity="0.85" />
    </svg>
  );
}

/** Λογότυπο με το όνομα δίπλα. */
export function Logo({
  className,
  markClassName,
  monochrome,
}: {
  className?: string;
  markClassName?: string;
  monochrome?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={markClassName} monochrome={monochrome} />
      <span className="font-semibold tracking-tight">
        Nutre<span className="text-primary">luma</span>
      </span>
    </span>
  );
}
