import type { ReactNode } from "react";

type PageBodyProps = {
  children: ReactNode;
  className?: string;
};

export function PageBody({ children, className }: PageBodyProps) {
  return (
    <div
      // The whole shell scrolls at every width, so content passes under the app header and
      // behind the floating tab bar and picks up their clearance. No nested scroll region:
      // a second one would keep the page's title from ever reaching the header.
      className={`flex-1 px-4 py-5 md:px-8 md:py-7${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
