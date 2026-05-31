import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-cream dark:ring-offset-darkBg',
  {
    variants: {
      variant: {
        default: 'bg-orange text-white shadow-sm hover:bg-deepOrange',
        outline:
          'border border-brown/20 bg-white text-brown hover:border-brown hover:bg-brown hover:text-white dark:border-darkBorder dark:bg-darkCard dark:text-darkText dark:hover:bg-darkBg',
        ghost: 'text-brown hover:bg-white/70 dark:text-darkText dark:hover:bg-darkBg/70',
        secondary: 'bg-brown text-white hover:bg-chocolate dark:bg-darkBg dark:text-darkText dark:hover:bg-darkBorder'
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11'
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
