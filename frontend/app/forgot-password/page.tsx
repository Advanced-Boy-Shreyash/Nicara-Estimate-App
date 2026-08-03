"use client";

import { useState } from "react";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";
import AuthCard, { AuthError, AuthField, AuthSubmit, AuthSuccess } from "@/components/auth/AuthCard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError("Enter the email address on your account."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await authApi.requestPasswordReset(email.trim());
      setSent(res.detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your account email and we'll send you a link to choose a new password."
      footer={<Link href="/login" className="text-nicara-gold font-semibold hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <AuthSuccess message={sent} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {error && <AuthError message={error} />}
          <AuthField
            id="email" label="Email" type="email" value={email} onChange={setEmail}
            placeholder="you@company.com" autoComplete="username" autoFocus
          />
          <AuthSubmit busy={busy} busyLabel="Sending…" label="Send reset link" />
        </form>
      )}
    </AuthCard>
  );
}
