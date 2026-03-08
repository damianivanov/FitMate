import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface CircleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export const CircleButton = ({ children, className = '', ...props }: CircleButtonProps) => {
  return (
    <button
      className={`w-12 h-12 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
