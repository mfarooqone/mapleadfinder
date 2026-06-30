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
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({});

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
    if (!login.trim()) next.login = "Username is required";
    else if (login.trim().length < 2) next.login = "Enter a valid username";
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
        { login: string; password: string }
      >("/auth/login", { login: login.trim(), password });

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
      subtitle="Use your assigned username and password"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login" className="label">
              Username
            </label>
            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                setErrors((c) => ({ ...c, login: undefined }));
                setSubmitError("");
              }}
              placeholder="farooq"
              className={`input ${errors.login ? "input-error" : ""}`}
              autoComplete="username"
            />
            {errors.login ? (
              <p className="mt-1 text-xs text-red-600">{errors.login}</p>
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
