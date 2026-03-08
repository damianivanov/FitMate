import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface OutlinedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export const OutlinedButton = ({ children, className = '', ...props }: OutlinedButtonProps) => {
  return (
    <button
      className={`cursor-pointer inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-white/50 bg-white/5 text-white/90 font-semibold text-sm transition-all hover:bg-white/10 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
