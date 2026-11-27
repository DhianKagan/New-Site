import * as React from 'react';
import { cn } from '../../lib/utils.ts';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        'h-9 sm:h-10 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#0d1f33] shadow-2xs transition-colors focus-visible:outline-none focus-visible:border-[#1769aa] focus-visible:ring-1 focus-visible:ring-[#1769aa] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';
