"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { postJson } from "@/lib/backend";
import AuthLayout from "./AuthLayout";
import GoogleAuthButton from "./GoogleAuthButton";
import {
  clearAuthSession,
  getAuthCookieToken,
  getAuthToken,
  setAuthCookie,
  setAuthSession,
  type LoginResponse,
} from "@/lib/auth";

type SignupErrors = {
  name?: string;
  email?: string;
  password?: string;
  code?: string;
};

export default function SignupComponent() {
  const router = useRouter();
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    if (!getAuthCookieToken() && !setAuthCookie(token)) {
      clearAuthSession();
      setSubmitError("Cookies are blocked. Enable cookies and try again.");
      return;
    }

    router.replace("/dashboard/whatsapp/setup");
  }, [router]);

  const validate = () => {
    const next: SignupErrors = {};
    const normalizedEmail = email.trim();

    if (name.trim().length > 80) next.name = "Name is too long";

    if (!normalizedEmail) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      next.email = "Enter a valid email";
    }

    if (!password) next.password = "Password is required";
    else if (password.length < 6) next.password = "At least 6 characters";

    return next;
  };

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitError("");
    setNotice("");
    setLoading(true);

    try {
      const response = await postJson<
        { requiresVerification: boolean; email: string; expiresAt: string; note?: string },
        { name?: string; email: string; password: string }
      >("/auth/signup", {
        name: name.trim() || undefined,
        email: email.trim(),
        password,
      });

      setVerificationEmail(response.email);
      setVerificationSent(true);
      setNotice(response.note ?? `We sent a verification code to ${response.email}.`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Signup failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setErrors({ code: "Enter the 6-digit code" });
      return;
    }

    setErrors({});
    setSubmitError("");
    setLoading(true);

    try {
      const session = await postJson<
        LoginResponse,
        { email: string; code: string }
      >("/auth/signup/verify", {
        email: verificationEmail,
        code: trimmedCode,
      });

      if (!setAuthSession(session)) {
        clearAuthSession();
        setSubmitError("Cookies are blocked. Enable cookies and try again.");
        return;
      }

      router.replace("/dashboard/whatsapp/setup");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Verification failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!verificationEmail) return;

    setErrors({});
    setSubmitError("");
    setNotice("");
    setResending(true);

    try {
      const response = await postJson<
        { requiresVerification: boolean; email: string; expiresAt: string; note?: string },
        { email: string }
      >("/auth/signup/resend", {
        email: verificationEmail,
      });

      setCode("");
      setNotice(response.note ?? `We sent a new verification code to ${response.email}.`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not resend code. Try again.",
      );
    } finally {
      setResending(false);
    }
  };

  const clearFieldError = (field: keyof SignupErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  };

  return (
    <AuthLayout
      title="Create your MapLeadFinder account"
      subtitle="Verify your email first. Temporary email addresses are blocked."
    >
        {!verificationSent && googleEnabled ? (
          <div className="mb-5 space-y-4">
            <GoogleAuthButton
              mode="signup"
              onSuccess={() => router.replace("/dashboard/whatsapp/setup")}
              onError={setSubmitError}
            />
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />
              <span>or</span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
          </div>
        ) : null}

        {!verificationSent ? (
        <form onSubmit={handleRequestCode} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="label">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearFieldError("name");
              }}
              placeholder="Rehman Ahmed"
              className={`input ${errors.name ? "input-error" : ""}`}
              autoComplete="name"
            />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
              placeholder="you@example.com"
              className={`input ${errors.email ? "input-error" : ""}`}
              autoComplete="email"
            />
            {errors.email ? (
              <p className="mt-1 text-xs text-red-600">{errors.email}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
              placeholder="At least 6 characters"
              className={`input ${errors.password ? "input-error" : ""}`}
              autoComplete="new-password"
            />
            {errors.password ? (
              <p className="mt-1 text-xs text-red-600">{errors.password}</p>
            ) : null}
          </div>

          {submitError ? <div className="alert alert-error">{submitError}</div> : null}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Send verification code"}
          </button>
        </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4" noValidate>
            {notice ? <div className="alert alert-info">{notice}</div> : null}

            <div>
              <label htmlFor="code" className="label">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  clearFieldError("code");
                }}
                placeholder="123456"
                className={`input ${errors.code ? "input-error" : ""}`}
                autoComplete="one-time-code"
              />
              {errors.code ? (
                <p className="mt-1 text-xs text-red-600">{errors.code}</p>
              ) : null}
            </div>

            {submitError ? <div className="alert alert-error">{submitError}</div> : null}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Verify and create account"}
            </button>

            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={loading || resending}
              onClick={handleResendCode}
            >
              {resending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Resend code"}
            </button>

            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={loading || resending}
              onClick={() => {
                setVerificationSent(false);
                setCode("");
                setNotice("");
                setSubmitError("");
              }}
            >
              Change email
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            Sign in
          </Link>
        </p>
    </AuthLayout>
  );
}
