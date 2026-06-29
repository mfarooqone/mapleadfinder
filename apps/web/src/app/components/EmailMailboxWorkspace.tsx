"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Inbox,
  Mail,
  MailOpen,
  RefreshCw,
  Send,
  Settings,
} from "lucide-react";
import {
  fetchMailboxMessages,
  getJson,
  postJson,
  type MailboxMessage,
  type MailboxMessagesResponse,
  type MailboxSettings,
  type MailboxSettingsPayload,
  type MailboxSyncResponse,
  type SmtpSettings,
} from "@/lib/backend";
import AppShell from "./AppShell";
import PageHeader, { PageLink } from "./PageHeader";
import StatusBanner, { type BannerState } from "./StatusBanner";

type MailboxTab = "ALL" | "INBOX" | "SENT";

export default function EmailMailboxWorkspace() {
  const [settings, setSettings] = useState<MailboxSettings | null>(null);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [messages, setMessages] = useState<MailboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MailboxMessage | null>(null);
  const [tab, setTab] = useState<MailboxTab>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<MailboxSettingsPayload>({
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    imapUsername: "",
    imapPassword: "",
    inboxFolder: "INBOX",
    sentFolder: "Sent",
    isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const visibleMessages = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return messages.filter((message) => {
      if (unreadOnly && message.isRead) return false;
      if (!needle) return true;
      return [
        message.subject,
        message.fromEmail,
        message.fromName,
        ...message.toEmails,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [messages, search, unreadOnly]);

  const loadSettings = async () => {
    const [mailbox, smtp] = await Promise.all([
      getJson<MailboxSettings>("/email/mailbox/settings"),
      getJson<SmtpSettings>("/email/smtp-settings").catch(() => null),
    ]);
    setSettings(mailbox);
    setSmtpSettings(smtp);

    if (mailbox.configured) {
      setForm({
        imapHost: mailbox.imapHost ?? "",
        imapPort: mailbox.imapPort ?? 993,
        imapSecure: mailbox.imapSecure ?? true,
        imapUsername: mailbox.imapUsername ?? "",
        imapPassword: "",
        inboxFolder: mailbox.inboxFolder ?? "INBOX",
        sentFolder: mailbox.sentFolder ?? "Sent",
        isActive: mailbox.isActive ?? true,
      });
    } else if (smtp?.configured) {
      setForm((current) => ({
        ...current,
        imapHost: smtp.host?.replace(/^smtp\./i, "mail.") ?? smtp.host ?? "",
        imapUsername: smtp.username ?? smtp.fromEmail ?? "",
      }));
    }

    return mailbox;
  };

  const loadMessages = async (nextTab = tab) => {
    const response: MailboxMessagesResponse = await fetchMailboxMessages(nextTab);
    setMessages(response.messages);
    setSelectedId((current) => {
      if (current && response.messages.some((message) => message.id === current)) {
        return current;
      }
      return response.messages[0]?.id ?? null;
    });
    return response;
  };

  const loadWorkspace = async () => {
    const mailbox = await loadSettings();
    if (mailbox.configured) {
      await loadMessages(tab);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadWorkspace();
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message: error instanceof Error ? error.message : "Could not load mailbox.",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedMessage(null);
      return;
    }

    let active = true;
    setOpening(true);
    void getJson<MailboxMessage>(`/email/mailbox/messages/${encodeURIComponent(selectedId)}`)
      .then((message) => {
        if (!active) return;
        setSelectedMessage(message);
        setMessages((current) =>
          current.map((item) => (item.id === message.id ? { ...item, ...message } : item)),
        );
      })
      .catch((error) => {
        if (!active) return;
        setBanner({
          type: "error",
          message: error instanceof Error ? error.message : "Could not open email.",
        });
      })
      .finally(() => {
        if (active) setOpening(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const refreshAll = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      await loadWorkspace();
      setBanner({ type: "success", message: "Mailbox refreshed." });
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
      const payload: MailboxSettingsPayload = {
        ...form,
        imapHost: form.imapHost.trim(),
        imapUsername: form.imapUsername.trim(),
        imapPassword: form.imapPassword?.trim() || undefined,
        inboxFolder: form.inboxFolder?.trim() || "INBOX",
        sentFolder: form.sentFolder?.trim() || "Sent",
      };
      const response = await postJson<
        { saved: boolean; settings: MailboxSettings },
        MailboxSettingsPayload
      >("/email/mailbox/settings", payload);
      setSettings(response.settings);
      setForm((current) => ({ ...current, imapPassword: "" }));
      setBanner({ type: "success", message: "Mailbox settings saved." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save mailbox settings.",
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
        "/email/mailbox/settings/test",
        {},
      );
      await loadSettings();
      setBanner({ type: "success", message: response.note });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "IMAP test failed.",
      });
    } finally {
      setTesting(false);
    }
  };

  const syncMailbox = async () => {
    setSyncing(true);
    setBanner(null);
    try {
      const response = await postJson<MailboxSyncResponse, Record<string, never>>(
        "/email/mailbox/sync",
        {},
      );
      await loadSettings();
      await loadMessages(tab);
      setBanner({
        type: "success",
        message: `${response.note} Imported ${response.imported}, updated ${response.updated}.`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Mailbox sync failed.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const switchTab = async (nextTab: MailboxTab) => {
    setTab(nextTab);
    setSelectedMessage(null);
    await loadMessages(nextTab);
  };

  const markRead = async (message: MailboxMessage, isRead: boolean) => {
    const updated = await postJson<MailboxMessage, { isRead: boolean }>(
      `/email/mailbox/messages/${encodeURIComponent(message.id)}/read`,
      { isRead },
    );
    setMessages((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    );
    setSelectedMessage((current) =>
      current?.id === updated.id ? { ...current, ...updated } : current,
    );
  };

  return (
    <AppShell onRefresh={() => void refreshAll()} refreshing={refreshing}>
      <div className="flex flex-col gap-4 pb-20 xl:pb-6">
        <PageHeader
          title="Email mailbox"
          description={`Inbox and Sent mail from the last ${settings?.windowDays ?? 3} days.`}
          actions={
            <>
              <PageLink href="/dashboard/email">
                <Send className="h-4 w-4" />
                Campaigns
              </PageLink>
              <button
                type="button"
                onClick={() => void syncMailbox()}
                disabled={syncing || !settings?.configured}
                className="btn btn-primary"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync"}
              </button>
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={refreshing}
                className="btn btn-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </>
          }
        />

        <StatusBanner banner={banner} />

        {!settings?.configured ? (
          <section className="hint-box hint-box-info text-sm">
            <Settings className="mr-1 inline h-4 w-4" />
            Save IMAP settings below to show recent Inbox and Sent mail.
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="card card-pad space-y-3">
              <div>
                <p className="section-label">Mailbox</p>
                <h2 className="text-lg font-semibold text-neutral-900">IMAP settings</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px] xl:grid-cols-[minmax(0,1fr)_100px]">
                <div>
                  <label className="label">IMAP host</label>
                  <input
                    value={form.imapHost}
                    onChange={(event) => setForm({ ...form, imapHost: event.target.value })}
                    placeholder="mail.example.com"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={form.imapPort}
                    onChange={(event) =>
                      setForm({ ...form, imapPort: Number(event.target.value) })
                    }
                    className="input"
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.imapSecure}
                  onChange={(event) =>
                    setForm({ ...form, imapSecure: event.target.checked })
                  }
                  className="mt-1"
                />
                Use SSL/TLS connection.
              </label>
              <div>
                <label className="label">Username</label>
                <input
                  value={form.imapUsername}
                  onChange={(event) => setForm({ ...form, imapUsername: event.target.value })}
                  placeholder="name@example.com"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Password / app password</label>
                <input
                  type="password"
                  value={form.imapPassword}
                  onChange={(event) => setForm({ ...form, imapPassword: event.target.value })}
                  placeholder={settings?.hasPassword ? "Saved password unchanged" : "IMAP password"}
                  className="input"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                <div>
                  <label className="label">Inbox folder</label>
                  <input
                    value={form.inboxFolder}
                    onChange={(event) => setForm({ ...form, inboxFolder: event.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Sent folder</label>
                  <input
                    value={form.sentFolder}
                    onChange={(event) => setForm({ ...form, sentFolder: event.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  className="mt-1"
                />
                Use IMAP sync and save app-sent mail into Sent.
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={saving || !form.imapHost.trim() || !form.imapUsername.trim()}
                  className="btn btn-primary"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Saving..." : "Save IMAP"}
                </button>
                <button
                  type="button"
                  onClick={() => void testSettings()}
                  disabled={testing || !settings?.configured}
                  className="btn btn-secondary"
                >
                  <Mail className="h-4 w-4" />
                  {testing ? "Testing..." : "Test"}
                </button>
              </div>
              {settings?.configured ? (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-900">
                    {settings.isActive ? "IMAP active" : "IMAP inactive"}
                  </p>
                  <p>{settings.imapHost}:{settings.imapPort}</p>
                  <p>Last sync: {settings.lastSyncedAt ? new Date(settings.lastSyncedAt).toLocaleString() : "Not synced yet"}</p>
                  {settings.lastSyncError ? (
                    <p className="text-red-600">Sync error: {settings.lastSyncError}</p>
                  ) : null}
                  {settings.lastVerifyError ? (
                    <p className="text-red-600">Test error: {settings.lastVerifyError}</p>
                  ) : null}
                </div>
              ) : smtpSettings?.configured ? (
                <p className="text-xs text-neutral-500">
                  Prefilled from SMTP where possible. Use the same mailbox password.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid min-h-[640px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="card card-pad flex min-h-0 flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {(["ALL", "INBOX", "SENT"] as MailboxTab[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void switchTab(item)}
                    disabled={!settings?.configured}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      tab === item
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-neutral-200 bg-white text-neutral-600"
                    }`}
                  >
                    {item === "ALL" ? "All" : item === "INBOX" ? "Inbox" : "Sent"}
                  </button>
                ))}
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search recent mail..."
                className="input"
              />
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => setUnreadOnly(event.target.checked)}
                />
                Unread only
              </label>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200">
                {loading ? (
                  <p className="p-3 text-sm text-neutral-500">Loading mailbox...</p>
                ) : visibleMessages.length === 0 ? (
                  <p className="p-3 text-sm text-neutral-500">
                    No recent messages in this view.
                  </p>
                ) : (
                  visibleMessages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => setSelectedId(message.id)}
                      className={`block w-full border-b border-neutral-100 p-3 text-left transition hover:bg-neutral-50 ${
                        selectedId === message.id ? "bg-emerald-50" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {message.folder === "SENT"
                            ? message.toEmails.join(", ") || "Sent mail"
                            : message.fromName || message.fromEmail || "Unknown sender"}
                        </p>
                        <span className="shrink-0 text-[11px] text-neutral-500">
                          {formatMailDate(message.receivedAt ?? message.sentAt)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-neutral-700">
                        {message.subject || "(no subject)"}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500">
                        {message.folder === "INBOX" ? (
                          <Inbox className="h-3.5 w-3.5" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        <span>{message.isRead ? "Read" : "Unread"}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="card card-pad min-h-0 overflow-y-auto">
              {!selectedMessage ? (
                <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-neutral-500">
                  {opening ? "Opening email..." : "Select an email to view it."}
                </div>
              ) : (
                <article className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="section-label">
                        {selectedMessage.folder === "INBOX" ? "Inbox" : "Sent"}
                      </p>
                      <h2 className="text-xl font-semibold text-neutral-900">
                        {selectedMessage.subject || "(no subject)"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => void markRead(selectedMessage, !selectedMessage.isRead)}
                      className="btn btn-secondary text-xs"
                    >
                      {selectedMessage.isRead ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <MailOpen className="h-4 w-4" />
                      )}
                      Mark {selectedMessage.isRead ? "unread" : "read"}
                    </button>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                    <p>
                      <span className="font-medium text-neutral-900">From:</span>{" "}
                      {formatSender(selectedMessage)}
                    </p>
                    <p>
                      <span className="font-medium text-neutral-900">To:</span>{" "}
                      {selectedMessage.toEmails.join(", ") || "-"}
                    </p>
                    <p>
                      <span className="font-medium text-neutral-900">Date:</span>{" "}
                      {formatFullDate(selectedMessage.receivedAt ?? selectedMessage.sentAt)}
                    </p>
                  </div>
                  <pre className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 font-sans text-sm leading-6 text-neutral-800">
                    {messageBody(selectedMessage)}
                  </pre>
                </article>
              )}
            </section>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function formatSender(message: MailboxMessage) {
  if (message.fromName && message.fromEmail) {
    return `${message.fromName} <${message.fromEmail}>`;
  }
  return message.fromEmail || message.fromName || "-";
}

function messageBody(message: MailboxMessage) {
  if (message.textBody?.trim()) return message.textBody;
  if (message.htmlBody?.trim()) return stripHtml(message.htmlBody);
  return "No preview body was available for this email.";
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function formatMailDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatFullDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
