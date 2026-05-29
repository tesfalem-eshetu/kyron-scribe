"use client";

import { X } from "lucide-react";
import { useFocusTrap } from "./useFocusTrap";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  closeDisabled?: boolean;
  showClose?: boolean;
  labelledById?: string;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  className,
  closeDisabled,
  showClose = true,
  labelledById = "modal-title",
}: ModalProps) {
  const ref = useFocusTrap<HTMLDivElement>(() => {
    if (!closeDisabled) onClose();
  });

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${className ?? ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
      >
        <div className="modal-head">
          <h3 id={labelledById}>{title}</h3>
          {showClose && (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Close dialog"
              onClick={onClose}
              disabled={closeDisabled}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
