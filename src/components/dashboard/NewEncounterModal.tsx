"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { apiFetch, isApiError } from "@/lib/client/api";
import { useToast } from "@/components/providers/ToastProvider";

interface CreatedEncounter {
  id: string;
}

export function NewEncounterModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const toast = useToast();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dob, setDob] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const fe: Record<string, string> = {};
    if (!first.trim()) fe.first = "Required.";
    if (!last.trim()) fe.last = "Required.";
    if (!dob) fe.dob = "Required.";
    setErrors(fe);
    if (Object.keys(fe).length) return;

    setSubmitting(true);
    try {
      const { encounter } = await apiFetch<{ encounter: CreatedEncounter }>(
        "/api/provider/encounters",
        {
          method: "POST",
          body: {
            patient: {
              firstName: first.trim(),
              lastName: last.trim(),
              dateOfBirth: dob,
            },
          },
        },
      );
      onCreated(encounter.id);
    } catch (error) {
      setSubmitting(false);
      toast.push({
        type: "error",
        message: isApiError(error)
          ? error.message
          : "Could not create the encounter.",
      });
    }
  }

  return (
    <Modal
      title="New Encounter"
      onClose={onClose}
      className="modal-ne"
      closeDisabled={submitting}
      labelledById="ne-title"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="ne-form"
            loading={submitting}
          >
            {submitting ? "Creating…" : "Create encounter"}
          </Button>
        </>
      }
    >
      <form id="ne-form" className="modal-body" onSubmit={submit} noValidate>
        <div className="ne-grid">
          <TextField
            label="First name"
            autoComplete="off"
            autoFocus
            value={first}
            disabled={submitting}
            error={errors.first}
            onChange={(e) => {
              setFirst(e.target.value);
              if (errors.first) setErrors((s) => ({ ...s, first: "" }));
            }}
          />
          <TextField
            label="Last name"
            autoComplete="off"
            value={last}
            disabled={submitting}
            error={errors.last}
            onChange={(e) => {
              setLast(e.target.value);
              if (errors.last) setErrors((s) => ({ ...s, last: "" }));
            }}
          />
          <TextField
            label="Date of birth"
            type="date"
            className="span2"
            max={today}
            value={dob}
            disabled={submitting}
            error={errors.dob}
            onChange={(e) => {
              setDob(e.target.value);
              if (errors.dob) setErrors((s) => ({ ...s, dob: "" }));
            }}
          />
        </div>
      </form>
    </Modal>
  );
}
