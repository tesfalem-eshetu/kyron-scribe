"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      block,
      loading,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    const classes = [
      "btn",
      `btn-${variant}`,
      size === "sm" ? "btn-sm" : "",
      block ? "btn-block" : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && <Loader2 className="spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
