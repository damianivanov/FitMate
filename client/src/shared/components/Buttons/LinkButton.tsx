import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export const LinkButton = ({ children, className = '', ...props }: LinkButtonProps) => {
  return (
    <button
      className={`text-white/70 hover:text-white/90 underline hover:no-underline transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
