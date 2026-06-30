"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { postJson } from "@/lib/backend";
import AuthLayout from "./AuthLayout";
import { clearAuthSession, setAuthSession, type LoginResponse } from "@/lib/auth";

type ForgotPasswordErrors = {
  email?: string;
  code?: string;
  password?: string;
};

export default function ForgotPasswordComponent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ForgotPasswordErrors>({});
  const [submitError, setSubmitError] = useState("");

  const normalizedEmail = email.trim();

  const validateEmail = () => {
    const next: ForgotPasswordErrors = {};
    if (!normalizedEmail) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      next.email = "Enter a valid email";
    }
    return next;
  };

  const validateReset = () => {
    const next: ForgotPasswordErrors = {};
    if (!/^\d{6}$/.test(code.trim())) next.code = "Enter the 6-digit code";
    if (!password) next.password = "Password is required";
    else if (password.length < 6) next.password = "At least 6 characters";
    return next;
  };

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateEmail();
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
        { requiresVerification: boolean; email: string; note?: string },
        { email: string }
      >("/auth/password/forgot", { email: normalizedEmail });

      setCodeSent(true);
      setNotice(
        response.note ??
          "If this email belongs to an active account, we sent a password reset code.",
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not request reset code.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateReset();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitError("");
    setLoading(true);

    try {
      const session = await postJson<
        LoginResponse,
        { email: string; code: string; password: string }
      >("/auth/password/reset", {
        email: normalizedEmail,
        code: code.trim(),
        password,
      });

      if (!setAuthSession(session)) {
        clearAuthSession();
        setSubmitError("Cookies are blocked. Enable cookies and try again.");
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not reset password.",
      );
    } finally {
      setLoading(false);
    }
  };

  const clearFieldError = (field: keyof ForgotPasswordErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send a 6-digit reset code."
    >
      {!codeSent ? (
        <form onSubmit={handleRequestCode} className="space-y-4" noValidate>
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

          {submitError ? <div className="alert alert-error">{submitError}</div> : null}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Send reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          {notice ? <div className="alert alert-info">{notice}</div> : null}

          <div>
            <label htmlFor="code" className="label">
              Reset code
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

          <div>
            <label htmlFor="password" className="label">
              New password
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
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Reset password"}
          </button>

          <button
            type="button"
            className="btn btn-secondary w-full"
            disabled={loading}
            onClick={() => {
              setCodeSent(false);
              setCode("");
              setPassword("");
              setNotice("");
              setSubmitError("");
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-neutral-500">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-emerald-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
