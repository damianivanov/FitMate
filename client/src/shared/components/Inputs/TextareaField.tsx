import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { FormField } from "./FormField";

const defaultTextareaClassName =
  "liquid-input min-h-24 w-full rounded-2xl px-4 py-3 leading-snug outline-none focus:outline-none";

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  children?: never;
  label: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  helperTextClassName?: string;
  errorClassName?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
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
      ...textareaProps
    },
    ref,
  ) {
    const resolvedTextareaClassName = [defaultTextareaClassName, className].filter(Boolean).join(" ");

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
        <textarea
          id={id}
          ref={ref}
          className={resolvedTextareaClassName}
          required={required}
          {...textareaProps}
        />
      </FormField>
    );
  },
);
