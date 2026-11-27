import * as React from 'react';
import { cn } from '../../lib/utils.ts';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[15px] text-[#0d1f33] shadow-2xs transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-[#1769aa] focus-visible:ring-1 focus-visible:ring-[#1769aa] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';
