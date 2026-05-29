"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "./Button";
import { useFocusTrap } from "./useFocusTrap";

interface ConfirmDialogProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone = "danger",
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useFocusTrap<HTMLDivElement>(() => {
    if (!loading) onCancel();
  });

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        ref={ref}
        className="modal confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="modal-head">
          <h3 id="confirm-title">{title}</h3>
        </div>
        <div className="modal-body">
          <TriangleAlert
            className={`ci ${tone === "danger" ? "danger" : "warn"}`}
            aria-hidden="true"
          />
          <div className="t-body" style={{ color: "var(--text-secondary)" }}>
            {body}
          </div>
        </div>
        <div className="modal-foot">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
