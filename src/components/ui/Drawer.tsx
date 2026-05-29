"use client";

import { X } from "lucide-react";
import { useFocusTrap } from "./useFocusTrap";

interface DrawerProps {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  header?: React.ReactNode;
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
  className,
  ariaLabel,
  header,
}: DrawerProps) {
  const ref = useFocusTrap<HTMLElement>(onClose);

  return (
    <>
      <div className="drawer-scrim" onMouseDown={onClose} aria-hidden="true" />
      <aside
        ref={ref}
        className={`drawer ${className ?? ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        {header ?? (
          <div className="drawer-head">
            <h3>{title}</h3>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Close panel"
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}
