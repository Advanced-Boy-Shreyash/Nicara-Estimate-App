"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import AuthCard, { AuthError, AuthField, AuthSubmit, PasswordRules } from "@/components/auth/AuthCard";

function ResetPasswordForm() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  /* The uid/token pair comes from the emailed link. */
  const params = useSearchParams();
  const uid = params.get("uid");
  const resetToken = params.get("token");
  const link = uid && resetToken ? { uid, token: resetToken } : null;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true);
    setError("");
    setFieldErrors({});

    const result = await resetPassword(link.uid, link.token, password);
    if (result.success) {
      router.replace("/dashboard");
      return;
    }
    setError(result.error || "Could not reset your password.");
    setFieldErrors(result.fieldErrors || {});
    setBusy(false);
  };

  if (!link) {
    return (
      <AuthCard
        title="Invalid reset link"
        subtitle="This link is missing its security token. Request a new one and try again."
        footer={<Link href="/forgot-password" className="text-nicara-gold font-semibold hover:underline">Request a new link</Link>}
      >
        <AuthError message="The reset link is incomplete or has been altered." />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Pick something you haven't used before. You'll be signed in straight after."
      footer={<Link href="/login" className="text-nicara-gold font-semibold hover:underline">Back to sign in</Link>}
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AuthError message={error} />}
        <AuthField
          id="new_password" label="New password" type="password" value={password} onChange={setPassword}
          placeholder="••••••••" autoComplete="new-password" autoFocus
          error={fieldErrors.new_password?.[0]}
        />
        <PasswordRules value={password} />
        <AuthField
          id="confirm_password" label="Confirm password" type="password" value={confirm} onChange={setConfirm}
          placeholder="••••••••" autoComplete="new-password"
        />
        <AuthSubmit busy={busy} busyLabel="Saving…" label="Set new password" />
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthProvider>
      {/* useSearchParams needs a Suspense boundary so the rest can prerender. */}
      <Suspense fallback={<AuthCard title="Loading…"><div /></AuthCard>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthProvider>
  );
}
