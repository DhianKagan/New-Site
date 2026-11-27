import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.ts';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1769aa] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[#0d1f33] text-white hover:bg-[#16324f]',
        primary: 'bg-[#1769aa] text-white hover:bg-[#12568c]',
        accent: 'bg-[#f59e0b] text-[#0d1f33] hover:bg-[#d97706] hover:text-white',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'border border-slate-300 bg-white text-[#0d1f33] hover:bg-slate-50',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-[#0d1f33]',
      },
      size: {
        default: 'h-9 sm:h-10 px-3.5 sm:px-4 py-2',
        sm: 'h-8 px-2.5 text-xs sm:text-sm',
        lg: 'h-11 px-5 text-sm sm:text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
