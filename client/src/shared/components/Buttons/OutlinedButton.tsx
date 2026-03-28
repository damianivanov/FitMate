import type { ButtonHTMLAttributes, ReactNode } from "react";

const outlinedToneClassNames = {
  default: "",
  primary: "liquid-pill-primary",
  active: "liquid-pill-primary-active text-white",
  danger: "liquid-pill-danger",
} as const;

const outlinedButtonSizeClassNames = {
  xs: "px-4 py-2 text-xs",
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-3 text-sm",
  icon: "h-9 w-9 p-0 text-sm",
} as const;

type OutlinedButtonTone = keyof typeof outlinedToneClassNames;
type OutlinedButtonSize = keyof typeof outlinedButtonSizeClassNames;

type OutlinedButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
  size?: OutlinedButtonSize;
  tone?: OutlinedButtonTone;
};

export function OutlinedButton({
  children,
  className = "",
  size = "md",
  tone = "default",
  type = "button",
  ...props
}: OutlinedButtonProps) {
  const resolvedClassName = [
    "liquid-pill inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold",
    outlinedToneClassNames[tone],
    outlinedButtonSizeClassNames[size],
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
