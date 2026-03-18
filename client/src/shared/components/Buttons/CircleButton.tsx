import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface CircleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export const CircleButton = ({ children, className = '', ...props }: CircleButtonProps) => {
  return (
    <button
      className={`liquid-pill h-12 w-12 inline-flex items-center justify-center rounded-full text-slate-700 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
