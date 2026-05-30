import type { ReactNode } from "react";

type PageBodyProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The shared scrollable page body. Centralises the `liquid-scrollbar` scroll
 * container so pages don't repeat the overflow/padding markup.
 */
export function PageBody({ children, className }: PageBodyProps) {
  return (
    <div
      className={`liquid-scrollbar flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
