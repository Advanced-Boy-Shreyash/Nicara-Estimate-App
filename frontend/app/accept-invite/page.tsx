"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import AuthCard, { AuthError, AuthField, AuthSubmit, PasswordRules } from "@/components/auth/AuthCard";

function AcceptInviteForm() {
  const { acceptInvite } = useAuth();
  const router = useRouter();
  /* The token comes from the invitation email link. */
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true);
    setError("");
    setFieldErrors({});

    const result = await acceptInvite(token, password);
    if (result.success) {
      router.replace("/dashboard");
      return;
    }
    setError(result.error || "Could not accept the invitation.");
    setFieldErrors(result.fieldErrors || {});
    setBusy(false);
  };

  if (!token) {
    return (
      <AuthCard
        title="Invitation not found"
        subtitle="This link is missing its invitation token. Ask your administrator to send a new invite."
        footer={<Link href="/login" className="text-nicara-gold font-semibold hover:underline">Back to sign in</Link>}
      >
        <AuthError message="The invitation link is incomplete or has already been used." />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome to NICARA"
      subtitle="Set a password to activate your account. You'll be signed in straight after."
      footer={<Link href="/login" className="text-nicara-gold font-semibold hover:underline">Already have an account? Sign in</Link>}
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AuthError message={error} />}
        <AuthField
          id="password" label="Create password" type="password" value={password} onChange={setPassword}
          placeholder="••••••••" autoComplete="new-password" autoFocus
          error={fieldErrors.password?.[0]}
        />
        <PasswordRules value={password} />
        <AuthField
          id="confirm_password" label="Confirm password" type="password" value={confirm} onChange={setConfirm}
          placeholder="••••••••" autoComplete="new-password"
        />
        <AuthSubmit busy={busy} busyLabel="Activating…" label="Activate account" />
      </form>
    </AuthCard>
  );
}

export default function AcceptInvitePage() {
  return (
    <AuthProvider>
      {/* useSearchParams needs a Suspense boundary so the rest can prerender. */}
      <Suspense fallback={<AuthCard title="Loading invitation…"><div /></AuthCard>}>
        <AcceptInviteForm />
      </Suspense>
    </AuthProvider>
  );
}
