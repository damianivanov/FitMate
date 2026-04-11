import type { ReactNode, Ref } from "react";

export type FormFieldProps = {
  id?: string;
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  helperTextClassName?: string;
  errorClassName?: string;
  containerRef?: Ref<HTMLDivElement>;
  children: ReactNode;
};

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

export function FormField({
  id,
  label,
  required = false,
  error,
  helperText,
  containerClassName = "space-y-1.5",
  labelClassName = "text-sm font-medium text-secondary",
  helperTextClassName = "text-xs text-secondary",
  errorClassName = "text-sm text-danger",
  containerRef,
  children,
}: FormFieldProps) {
  const labelId = id && label ? `${id}-label` : undefined;

  return (
    <div className={containerClassName} ref={containerRef}>
      {label ? (
        <label id={labelId} htmlFor={id} className={labelClassName}>
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}

      {children}

      {error ? (
        <p role="alert" className={errorClassName}>
          {error}
        </p>
      ) : helperText ? (
        <p className={joinClassNames(helperTextClassName)}>{helperText}</p>
      ) : null}
    </div>
  );
}
