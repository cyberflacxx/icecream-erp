import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[color:var(--app-accent-strong)] text-white shadow-sm hover:bg-[color:var(--app-accent)]',
        outline:
          'border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-text)] hover:border-[color:var(--app-border-strong)] hover:bg-[color:var(--app-bg-subtle)]',
        ghost: 'text-[color:var(--app-muted)] hover:bg-[color:var(--app-bg-subtle)] hover:text-[color:var(--app-text)]',
        secondary: 'bg-[color:var(--app-bg-subtle)] text-[color:var(--app-text)] hover:bg-[color:var(--app-bg-inset)]'
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3.5 text-[13px]',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
