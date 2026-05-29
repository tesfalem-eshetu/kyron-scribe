"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { apiFetch, isApiError } from "@/lib/client/api";
import type { SafeUser } from "@/lib/client/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const fe: { email?: string; password?: string } = {};
    if (!email.trim()) fe.email = "Enter your email address.";
    if (!password) fe.password = "Enter your password.";
    setErrors(fe);
    if (fe.email || fe.password) {
      setAlert(null);
      return;
    }

    setAlert(null);
    setSubmitting(true);
    try {
      const { user } = await apiFetch<{ user: SafeUser }>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      router.replace(user.role === "ADMIN" ? "/admin/encounters" : "/encounters");
      router.refresh();
    } catch (error) {
      setSubmitting(false);
      if (isApiError(error) && error.code === "ACCOUNT_INACTIVE") {
        setAlert({
          title: "Account unavailable.",
          message:
            "This account has been deactivated. Contact your clinic administrator.",
        });
      } else if (isApiError(error)) {
        setAlert({ title: "Sign-in failed.", message: error.message });
      } else {
        setAlert({
          title: "Sign-in failed.",
          message: "Something went wrong. Please try again.",
        });
      }
    }
  }

  return (
    <div className="center-stage">
      <div
        style={{ position: "fixed", top: 16, right: 16 }}
      >
        <ThemeToggle />
      </div>
      <div className="center-col">
        <div className="card login-card">
          <div className="login-head">
            <div className="login-brand">
              <span className="login-mark" aria-hidden="true">
                K
              </span>
              <span className="wordmark">Kyron Scribe</span>
            </div>
            <p className="login-desc">Clinical documentation</p>
          </div>

          <form className="login-form" onSubmit={onSubmit} noValidate>
            {alert && (
              <InlineAlert type="error" title={alert.title}>
                {alert.message}
              </InlineAlert>
            )}

            <TextField
              ref={emailRef}
              label="Email"
              type="email"
              autoComplete="username"
              placeholder="you@clinic.org"
              value={email}
              disabled={submitting}
              error={errors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((s) => ({ ...s, email: undefined }));
              }}
            />

            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              disabled={submitting}
              error={errors.password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password)
                  setErrors((s) => ({ ...s, password: undefined }));
              }}
            />

            <Button
              type="submit"
              variant="primary"
              block
              loading={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="login-foot">
            <span className="env">
              <ShieldCheck aria-hidden="true" /> HIPAA-secured
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
