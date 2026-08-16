"use client";

import { useEffect, useState } from "react";
import { useAuth, AuthProvider } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  /* Already signed in — skip the form. */
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isLoading, isAuthenticated, router]);

  /* Remembered address from the last successful sign-in. localStorage cannot
     be read while the server prerenders, so this has to land after mount. */
  useEffect(() => {
    const last = localStorage.getItem("nicara_last_email");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of an external store
    if (last) setEmail(last);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setSubmitting(true);
    setError("");
    setFieldErrors({});

    const result = await login(email, password);
    if (result.success) {
      if (remember) localStorage.setItem("nicara_last_email", email.trim());
      else localStorage.removeItem("nicara_last_email");
      router.replace("/dashboard");
      return;
    }

    setError(result.error || "Login failed");
    setFieldErrors(result.fieldErrors || {});
    setSubmitting(false);
  };

  const fieldError = (name: string) => fieldErrors[name]?.[0];

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex w-[55%] login-gradient login-pattern relative flex-col justify-between p-12 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full border border-nicara-gold/10" />
        <div className="absolute bottom-[-150px] left-[-80px] w-[500px] h-[500px] rounded-full border border-nicara-teal/5" />

        <div className="relative z-10">
          <div className="text-3xl font-black text-nicara-gold tracking-[0.2em] mb-1">NICARA</div>
          <div className="text-[11px] text-surface-500 tracking-[0.3em] uppercase">Project OS</div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Design. Estimate.<br />
            <span className="text-nicara-gold">Deliver.</span>
          </h1>
          <p className="text-[15px] text-surface-400 leading-relaxed">
            The all-in-one platform for interior design firms — manage projects, generate professional estimates, track procurement, and delight clients.
          </p>
          <div className="flex gap-6 mt-8">
            {[["250+", "Projects Delivered"], ["₹50Cr+", "Revenue Managed"], ["98%", "Client Satisfaction"]].map(([val, label]) => (
              <div key={label}>
                <div className="text-2xl font-black text-nicara-gold">{val}</div>
                <div className="text-[11px] text-surface-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-surface-600">
          © 2026 NICARA Design. All rights reserved.
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-50">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-2xl font-black text-nicara-gold tracking-[0.2em]">NICARA</div>
            <div className="text-[10px] text-surface-500 tracking-[0.3em] uppercase">Project OS</div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-nicara-dark">Welcome back</h2>
            <p className="text-[13px] text-surface-500 mt-1.5">Sign in to your NICARA account</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 animate-fade-in">
              <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✕</div>
              <div className="text-[12px] text-red-700 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="email" className="block text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Email</label>
              <input id="email" name="email" type="email" autoComplete="username" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
                className={`w-full px-4 py-3 border rounded-xl text-[13px] bg-white text-nicara-dark ${
                  fieldError("email") ? "border-red-300" : "border-surface-300"
                }`} autoFocus />
              {fieldError("email") && <div className="mt-1 text-[11px] text-red-600">{fieldError("email")}</div>}
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input id="password" name="password" type={showPwd ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className={`w-full px-4 py-3 border rounded-xl text-[13px] bg-white text-nicara-dark pr-12 ${
                    fieldError("password") ? "border-red-300" : "border-surface-300"
                  }`} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-surface-400 cursor-pointer text-sm hover:text-surface-600">
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
              {fieldError("password") && <div className="mt-1 text-[11px] text-red-600">{fieldError("password")}</div>}
            </div>

            <div className="flex justify-between items-center mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-nicara-gold cursor-pointer" />
                <span className="text-[12px] text-surface-500">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-[12px] text-nicara-gold font-semibold hover:underline">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={submitting}
              className={`w-full py-3.5 rounded-xl text-[14px] font-bold border-none cursor-pointer flex items-center justify-center gap-2 ${
                submitting ? "bg-surface-300 text-surface-500 cursor-not-allowed" : "btn-gold"
              }`}>
              {submitting ? <><span className="animate-spin-slow inline-block">⟳</span> Signing in…</> : "Sign In"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[11px] text-surface-400">
              Don&apos;t have an account? Contact your administrator for an invitation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
