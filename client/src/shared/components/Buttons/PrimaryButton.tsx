import type { ButtonHTMLAttributes, ReactNode } from "react";

const primaryButtonSizeClassNames = {
  xs: "px-4 py-2 text-xs",
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-3 text-sm",
} as const;

type PrimaryButtonSize = keyof typeof primaryButtonSizeClassNames;

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
  size?: PrimaryButtonSize;
};

export function PrimaryButton({
  children,
  className = "",
  size = "md",
  type = "button",
  ...props
}: PrimaryButtonProps) {
  const resolvedClassName = [
    "liquid-primary-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold",
    primaryButtonSizeClassNames[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={resolvedClassName} {...props}>
      {children}
    </button>
  );
}
