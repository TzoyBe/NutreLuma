import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // `active:scale` δίνει την αίσθηση αφής του iOS. Το transition περιλαμβάνει
  // transform, αλλά το reduced-motion το ακυρώνει καθολικά στο globals.css.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,box-shadow,transform,color] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-[0_1px_0_hsl(var(--glass-border)/0.42)_inset,0_12px_26px_-14px_hsl(var(--primary)/0.95)] hover:bg-primary/90',
        secondary: 'liquid-control text-secondary-foreground hover:bg-secondary/70',
        outline: 'liquid-control hover:bg-[hsl(var(--glass-bg)/0.72)]',
        ghost: 'hover:bg-[hsl(var(--glass-border)/0.18)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[0_1px_0_hsl(var(--glass-border)/0.3)_inset,0_12px_26px_-14px_hsl(var(--destructive)/0.95)] hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-4',
        md: 'h-11 px-5',
        lg: 'h-12 px-7 text-base',
        icon: 'h-10 w-10',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
