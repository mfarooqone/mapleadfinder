"use client";

import { useEffect, useState } from "react";
import { MailCheck, RefreshCw, Send } from "lucide-react";
import {
  getJson,
  postJson,
  type SmtpSettings,
  type SmtpSettingsPayload,
} from "@/lib/backend";
import AppShell from "./AppShell";
import PageHeader from "./PageHeader";
import StatusBanner, { type BannerState } from "./StatusBanner";

export default function SmtpSetupWorkspace() {
  const [settings, setSettings] = useState<SmtpSettings | null>(null);
  const [form, setForm] = useState<SmtpSettingsPayload>({
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    replyToEmail: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const loadSettings = async () => {
    const next = await getJson<SmtpSettings>("/email/smtp-settings");
    setSettings(next);
    if (next.configured) {
      setForm({
        host: next.host ?? "",
        port: next.port ?? 587,
        secure: Boolean(next.secure),
        username: next.username ?? "",
        password: "",
        fromEmail: next.fromEmail ?? "",
        fromName: next.fromName ?? "",
        replyToEmail: next.replyToEmail ?? "",
        isActive: next.isActive ?? true,
      });
    }
    return next;
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadSettings();
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message: error instanceof Error ? error.message : "Could not load SMTP settings.",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      await loadSettings();
      setBanner({ type: "success", message: "SMTP settings refreshed." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        ...form,
        host: form.host.trim(),
        username: form.username?.trim() || undefined,
        password: form.password?.trim() || undefined,
        fromEmail: form.fromEmail.trim(),
        fromName: form.fromName?.trim() || undefined,
        replyToEmail: form.replyToEmail?.trim() || undefined,
      };
      const response = await postJson<{ saved: boolean; settings: SmtpSettings }, SmtpSettingsPayload>(
        "/email/smtp-settings",
        payload,
      );
      setSettings(response.settings);
      setForm((current) => ({ ...current, password: "" }));
      setBanner({ type: "success", message: "SMTP settings saved." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save SMTP settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const testSettings = async () => {
    setTesting(true);
    setBanner(null);
    try {
      const response = await postJson<{ ok: boolean; note: string }, Record<string, never>>(
        "/email/smtp-settings/test",
        {},
      );
      await loadSettings();
      setBanner({ type: "success", message: response.note });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "SMTP test failed.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <AppShell onRefresh={() => void refreshAll()} refreshing={refreshing}>
      <div className="flex flex-col gap-4 pb-20 xl:pb-6">
        <PageHeader
          title="SMTP setup"
          description="Connect the email account used for bulk email outreach."
          actions={
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="btn btn-secondary"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          }
        />

        <StatusBanner banner={banner} />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="card card-pad space-y-4">
            <div>
              <p className="section-label">Email provider</p>
              <h2 className="text-lg font-semibold text-neutral-900">SMTP credentials</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Use your provider SMTP host, port, username, and app password.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div>
                <label className="label">SMTP host</label>
                <input
                  value={form.host}
                  onChange={(event) => setForm({ ...form, host: event.target.value })}
                  placeholder="smtp.gmail.com"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Port</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(event) => setForm({ ...form, port: Number(event.target.value) })}
                  className="input"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.secure}
                onChange={(event) => setForm({ ...form, secure: event.target.checked })}
                className="mt-1"
              />
              Use SSL/TLS connection. Enable for port 465, leave off for STARTTLS on 587.
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Username</label>
                <input
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                  placeholder="name@example.com"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Password / app password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder={settings?.hasPassword ? "Saved password unchanged" : "SMTP password"}
                  className="input"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">From email</label>
                <input
                  type="email"
                  value={form.fromEmail}
                  onChange={(event) => setForm({ ...form, fromEmail: event.target.value })}
                  placeholder="sales@example.com"
                  className="input"
                />
              </div>
              <div>
                <label className="label">From name</label>
                <input
                  value={form.fromName}
                  onChange={(event) => setForm({ ...form, fromName: event.target.value })}
                  placeholder="Lead Outreach"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Reply-to email</label>
              <input
                type="email"
                value={form.replyToEmail}
                onChange={(event) => setForm({ ...form, replyToEmail: event.target.value })}
                placeholder="Optional, defaults to From email"
                className="input"
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                className="mt-1"
              />
              Use these SMTP settings for queued emails.
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={saving || !form.host.trim() || !form.fromEmail.trim()}
                className="btn btn-primary"
              >
                <MailCheck className="h-4 w-4" />
                {saving ? "Saving..." : "Save SMTP"}
              </button>
              <button
                type="button"
                onClick={() => void testSettings()}
                disabled={testing || !settings?.configured}
                className="btn btn-secondary"
              >
                <Send className="h-4 w-4" />
                {testing ? "Testing..." : "Test connection"}
              </button>
            </div>
          </div>

          <aside className="card card-pad space-y-3 text-sm text-neutral-700">
            <p className="section-label">Status</p>
            {loading ? (
              <p>Loading SMTP status...</p>
            ) : settings?.configured ? (
              <>
                <p className="font-semibold text-neutral-900">
                  SMTP is configured{settings.isActive ? "" : " but inactive"}.
                </p>
                <p>{settings.host}:{settings.port}</p>
                <p>From: {settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail}</p>
                <p>Password: {settings.hasPassword ? "Saved" : "Not saved"}</p>
                {settings.lastVerifiedAt ? (
                  <p>Last verified: {new Date(settings.lastVerifiedAt).toLocaleString()}</p>
                ) : null}
                {settings.lastVerifyError ? (
                  <p className="text-red-600">Last error: {settings.lastVerifyError}</p>
                ) : null}
              </>
            ) : (
              <p>No SMTP settings saved yet.</p>
            )}
            {settings?.envFallbackAvailable ? (
              <div className="hint-box hint-box-info text-xs">
                Server `.env` SMTP fallback is also available.
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
