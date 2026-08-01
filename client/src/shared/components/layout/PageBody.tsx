import type { ReactNode } from "react";

type PageBodyProps = {
  children: ReactNode;
  className?: string;
};

export function PageBody({ children, className }: PageBodyProps) {
  return (
    <div
      // Mobile scrolls the whole shell, so content passes behind the floating tab bar and picks
      // up its clearance. Desktop keeps its own scroll region, which is what pins the header.
      className={`liquid-scrollbar flex-1 px-4 py-5 md:overflow-y-auto md:px-8 md:py-7${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
