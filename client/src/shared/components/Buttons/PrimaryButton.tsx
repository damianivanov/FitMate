import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export const PrimaryButton = ({ children, className = '', ...props }: PrimaryButtonProps) => {
  return (
    <button
      className={`liquid-primary-btn inline-flex items-center justify-center px-5 py-2.5 rounded-full font-semibold text-sm ${className}`}
      {...props}>
      {children}
    </button>
  );
};
