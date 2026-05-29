"use client";

import { forwardRef, useId } from "react";
import { CircleAlert } from "lucide-react";

interface BaseProps {
  label: string;
  error?: string;
  optional?: boolean;
  className?: string;
}

type InputProps = BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

export const TextField = forwardRef<HTMLInputElement, InputProps>(
  function TextField(
    { label, error, optional, className, id, ...rest },
    ref,
  ) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const errId = `${fieldId}-err`;
    return (
      <div className={`field ${className ?? ""}`.trim()}>
        <label htmlFor={fieldId}>
          {label}
          {optional && <span className="opt"> · optional</span>}
        </label>
        <input
          ref={ref}
          id={fieldId}
          className={`input${error ? " is-error" : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          {...rest}
        />
        {error && (
          <div className="field-error" id={errId}>
            <CircleAlert aria-hidden="true" /> {error}
          </div>
        )}
      </div>
    );
  },
);

type AreaProps = BaseProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    textareaClassName?: string;
  };

export function TextAreaField({
  label,
  error,
  optional,
  className,
  textareaClassName,
  id,
  ...rest
}: AreaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errId = `${fieldId}-err`;
  return (
    <div className={`field ${className ?? ""}`.trim()}>
      <label htmlFor={fieldId}>
        {label}
        {optional && <span className="opt"> · optional</span>}
      </label>
      <textarea
        id={fieldId}
        className={`textarea${textareaClassName ? " " + textareaClassName : ""}${
          error ? " is-error" : ""
        }`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        {...rest}
      />
      {error && (
        <div className="field-error" id={errId}>
          <CircleAlert aria-hidden="true" /> {error}
        </div>
      )}
    </div>
  );
}

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  label?: string;
  error?: string;
  className?: string;
}

export function SelectField({
  label,
  error,
  className,
  id,
  children,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const select = (
    <select
      id={fieldId}
      className={`select${error ? " is-error" : ""}`}
      aria-invalid={error ? true : undefined}
      {...rest}
    >
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <div className={`field ${className ?? ""}`.trim()}>
      <label htmlFor={fieldId}>{label}</label>
      {select}
      {error && (
        <div className="field-error">
          <CircleAlert aria-hidden="true" /> {error}
        </div>
      )}
    </div>
  );
}
