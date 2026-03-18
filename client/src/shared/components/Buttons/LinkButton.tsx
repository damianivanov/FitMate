import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export const LinkButton = ({ children, className = '', ...props }: LinkButtonProps) => {
  return (
    <button
      className={`liquid-link underline transition-colors hover:no-underline ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
