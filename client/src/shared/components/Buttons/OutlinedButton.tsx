import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface OutlinedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export const OutlinedButton = ({ children, className = '', ...props }: OutlinedButtonProps) => {
  return (
    <button
      className={`liquid-secondary-btn cursor-pointer inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-sm ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
