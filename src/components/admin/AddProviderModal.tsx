"use client";

import { useState } from "react";
import { Check, Copy, ShieldCheck, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { apiFetch, isApiError } from "@/lib/client/api";
import type { SafeUser } from "@/lib/client/types";

type Step = "form" | "credential";

export function AddProviderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [createdName, setCreatedName] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = "Required.";
    if (!email.trim()) fe.email = "Required.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      fe.email = "Enter a valid email address.";
    setErrors(fe);
    if (Object.keys(fe).length) return;

    setSubmitting(true);
    try {
      const result = await apiFetch<{
        user: SafeUser;
        temporaryPassword?: string;
      }>("/api/admin/providers", {
        method: "POST",
        body: { email: email.trim(), fullName: name.trim() },
      });
      setCreatedName(result.user.fullName);
      setTempPassword(result.temporaryPassword ?? "");
      setStep("credential");
    } catch (error) {
      setSubmitting(false);
      if (isApiError(error) && error.code === "CONFLICT") {
        setErrors({ email: "A user with this email already exists." });
      } else {
        setErrors({
          email: isApiError(error) ? error.message : "Could not create provider.",
        });
      }
    }
  }

  function copy() {
    navigator.clipboard?.writeText(tempPassword).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (step === "credential") {
    return (
      <Modal
        title="Provider created"
        onClose={() => {
          onCreated();
          onClose();
        }}
        showClose={false}
        className="modal-ne"
        labelledById="ap-title"
        footer={
          <Button
            variant="primary"
            onClick={() => {
              onCreated();
              onClose();
            }}
          >
            Done
          </Button>
        }
      >
        <div className="modal-body">
          <div className="cred-warn">
            <TriangleAlert
              style={{
                width: 18,
                height: 18,
                color: "var(--amber-600)",
                flex: "none",
                marginTop: 1,
              }}
              aria-hidden="true"
            />
            <div className="t-body" style={{ color: "var(--text-primary)" }}>
              <b>Copy this now. It will not be shown again.</b> The temporary
              password is displayed only once.
            </div>
          </div>
          <div className="cred-field">
            <div className="cl">Temporary password · {createdName}</div>
            <div className="cred-row">
              <span className="cred-pass">{tempPassword}</span>
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? (
                  <>
                    <Check aria-hidden="true" /> Copied
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="cred-meta">
            <ShieldCheck aria-hidden="true" /> Share securely with the provider.
            They should reset it on first sign-in.
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Add Provider"
      onClose={onClose}
      className="modal-ne"
      closeDisabled={submitting}
      labelledById="ap-title"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="ap-form"
            loading={submitting}
          >
            {submitting ? "Creating…" : "Create provider"}
          </Button>
        </>
      }
    >
      <form id="ap-form" className="modal-body" onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoFocus
          placeholder="name@clinic.org"
          value={email}
          disabled={submitting}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((s) => ({ ...s, email: "" }));
          }}
        />
        <TextField
          label="Full name"
          placeholder="Dr. Jane Smith"
          value={name}
          disabled={submitting}
          error={errors.name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((s) => ({ ...s, name: "" }));
          }}
        />
      </form>
    </Modal>
  );
}
