import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { FormField } from "./FormField";

const defaultInputClassName =
  "liquid-input w-full rounded-full px-3 py-2.5 outline-none focus:outline-none";

export type TextInputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "children"> & {
  label: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  helperTextClassName?: string;
  errorClassName?: string;
};

export const TextInputField = forwardRef<HTMLInputElement, TextInputFieldProps>(
  function TextInputField(
    {
      id,
      label,
      required = false,
      error,
      helperText,
      containerClassName,
      labelClassName,
      helperTextClassName,
      errorClassName,
      className,
      ...inputProps
    },
    ref,
  ) {
    const resolvedInputClassName = [defaultInputClassName, className].filter(Boolean).join(" ");

    return (
      <FormField
        id={id}
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        containerClassName={containerClassName}
        labelClassName={labelClassName}
        helperTextClassName={helperTextClassName}
        errorClassName={errorClassName}
      >
        <input id={id} ref={ref} className={resolvedInputClassName} required={required} {...inputProps} />
      </FormField>
    );
  },
);
