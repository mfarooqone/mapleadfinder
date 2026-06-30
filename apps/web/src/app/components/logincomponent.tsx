"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { postJson } from "@/lib/backend";
import AuthLayout from "./AuthLayout";
import {
  clearAuthSession,
  getAuthCookieToken,
  getAuthToken,
  setAuthCookie,
  setAuthSession,
  type LoginResponse,
} from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    if (!getAuthCookieToken() && !setAuthCookie(token)) {
      clearAuthSession();
      setSubmitError("Cookies are blocked. Enable cookies and try again.");
      return;
    }

    router.replace("/dashboard");
  }, [router]);

  const validate = () => {
    const next: typeof errors = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      next.email = "Enter a valid email";
    }
    if (!password) next.password = "Password is required";
    else if (password.length < 6) next.password = "At least 6 characters";
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
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
        { email: string; password: string }
      >("/auth/login", { email: email.trim(), password });

      if (!setAuthSession(session)) {
        clearAuthSession();
        setSubmitError("Cookies are blocked. Enable cookies and try again.");
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Sign in failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to MapLeadFinder"
      subtitle="Use your email and password"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((c) => ({ ...c, email: undefined }));
                setSubmitError("");
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
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((c) => ({ ...c, password: undefined }));
                setSubmitError("");
              }}
              placeholder="Your password"
              className={`input ${errors.password ? "input-error" : ""}`}
              autoComplete="current-password"
            />
            {errors.password ? (
              <p className="mt-1 text-xs text-red-600">{errors.password}</p>
            ) : null}
          </div>

          {submitError ? <div className="alert alert-error">{submitError}</div> : null}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          <Link href="/forgot-password" className="font-medium text-emerald-700 hover:underline">
            Forgot password?
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-neutral-500">
          Need a new account?{" "}
          <Link href="/signup" className="font-medium text-emerald-700 hover:underline">
            Create one
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-neutral-500">
          <Link href="/" className="font-medium text-emerald-700 hover:underline">
            Back to home
          </Link>
        </p>
    </AuthLayout>
  );
}
