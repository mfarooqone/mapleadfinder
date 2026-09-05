"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, RefreshCw, Save } from "lucide-react";
import {
  getJson,
  patchJson,
  postJson,
  type TemplateRecord,
} from "@/lib/backend";
import { isHtmlEmailBody, summarizeEmailBody } from "@/lib/email-html";
import AppShell from "./AppShell";
import PageHeader from "./PageHeader";
import StatusBanner, { type BannerState } from "./StatusBanner";

type TemplateChannel = "WHATSAPP" | "EMAIL";
type EmailBodyFormat = "PLAIN" | "HTML";

const CHANNELS: Array<{ label: string; value: TemplateChannel }> = [
  { label: "WhatsApp", value: "WHATSAPP" },
  { label: "Email", value: "EMAIL" },
];

export default function TemplatesWorkspace() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [activeChannel, setActiveChannel] = useState<TemplateChannel>("WHATSAPP");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [emailFormat, setEmailFormat] = useState<EmailBodyFormat>("PLAIN");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const activeTemplates = useMemo(
    () =>
      templates.filter(
        (template) => (template.channel ?? "WHATSAPP") === activeChannel,
      ),
    [activeChannel, templates],
  );

  const contentLooksHtml = isHtmlEmailBody(content);

  const loadTemplates = async () => {
    const nextTemplates = await getJson<TemplateRecord[]>("/templates");
    setTemplates(nextTemplates);
    return nextTemplates;
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadTemplates();
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message:
            error instanceof Error ? error.message : "Could not load templates.",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const resetForm = (channel = activeChannel) => {
    setActiveChannel(channel);
    setEditingTemplateId("");
    setName("");
    setSubject("");
    setContent("");
    setEmailFormat("PLAIN");
  };

  const refreshAll = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      await loadTemplates();
      setBanner({ type: "success", message: "Templates refreshed." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const editTemplate = (template: TemplateRecord) => {
    setActiveChannel(template.channel ?? "WHATSAPP");
    setEditingTemplateId(template.id);
    setName(template.name);
    setSubject(template.subject ?? "");
    setContent(template.content);
    setEmailFormat(
      (template.channel ?? "WHATSAPP") === "EMAIL" && isHtmlEmailBody(template.content)
        ? "HTML"
        : "PLAIN",
    );
  };

  const saveTemplate = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        channel: activeChannel,
        name: name.trim(),
        subject: activeChannel === "EMAIL" ? subject.trim() : undefined,
        content: content.trim(),
        category: activeChannel === "EMAIL" ? "EMAIL" : "MARKETING",
        language: "en_US",
        submitForApproval: false,
        metadata:
          activeChannel === "EMAIL"
            ? {
                format:
                  emailFormat === "HTML" || contentLooksHtml ? "HTML" : "PLAIN",
              }
            : undefined,
      };

      if (editingTemplateId) {
        await patchJson<TemplateRecord, typeof payload>(
          `/templates/${encodeURIComponent(editingTemplateId)}`,
          payload,
        );
      } else {
        await postJson<TemplateRecord, typeof payload>("/templates", payload);
      }

      await loadTemplates();
      resetForm(activeChannel);
      setBanner({
        type: "success",
        message: editingTemplateId ? "Template updated." : "Template created.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save template.",
      });
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    name.trim() &&
    content.trim() &&
    (activeChannel === "WHATSAPP" || subject.trim());

  return (
    <AppShell onRefresh={() => void refreshAll()} refreshing={refreshing}>
      <div className="flex flex-col gap-4 pb-20 xl:pb-6">
        <PageHeader
          title="Templates"
          description="Create and edit WhatsApp and email templates, including full HTML emails."
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

        <section className="card card-pad space-y-4">
          <div className="segmented w-full sm:w-auto">
            {CHANNELS.map((channel) => (
              <button
                key={channel.value}
                type="button"
                onClick={() => resetForm(channel.value)}
                className={`segmented-btn ${
                  activeChannel === channel.value ? "active" : ""
                }`}
              >
                {channel.label}
              </button>
            ))}
          </div>

          <div>
            <p className="section-label">
              {editingTemplateId ? "Edit template" : "Add template"}
            </p>
            <h2 className="text-lg font-semibold text-neutral-900">
              {activeChannel === "WHATSAPP" ? "WhatsApp template" : "Email template"}
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
            <div>
              <label className="label">Template name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="First outreach"
                className="input"
              />
            </div>

            {activeChannel === "EMAIL" ? (
              <div>
                <label className="label">Email subject</label>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Quick support for {{name}}"
                  className="input"
                />
              </div>
            ) : null}
          </div>

          {activeChannel === "EMAIL" ? (
            <div className="segmented w-full sm:w-auto">
              {(
                [
                  { label: "Plain text", value: "PLAIN" as const },
                  { label: "HTML email", value: "HTML" as const },
                ] as const
              ).map((format) => (
                <button
                  key={format.value}
                  type="button"
                  onClick={() => setEmailFormat(format.value)}
                  className={`segmented-btn ${
                    emailFormat === format.value ? "active" : ""
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          ) : null}

          <div>
            <label className="label">
              {activeChannel === "EMAIL" && emailFormat === "HTML"
                ? "HTML body"
                : "Template body"}
            </label>
            <textarea
              value={content}
              onChange={(event) => {
                const next = event.target.value;
                setContent(next);
                if (activeChannel === "EMAIL" && isHtmlEmailBody(next)) {
                  setEmailFormat("HTML");
                }
              }}
              rows={
                activeChannel === "EMAIL" && emailFormat === "HTML" ? 18 : activeChannel === "EMAIL" ? 10 : 5
              }
              placeholder={
                activeChannel === "EMAIL" && emailFormat === "HTML"
                  ? "<!DOCTYPE html>\n<html>\n...\nPaste full HTML email markup here. Placeholders like {{firstName}} still work.\n</html>"
                  : activeChannel === "EMAIL"
                    ? "Dear {{firstName}},\n\n..."
                    : "Hi {{firstName}}, quick question about {{website}}..."
              }
              className="input resize-y font-mono text-xs leading-5"
              spellCheck={emailFormat !== "HTML"}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Placeholders: {"{{firstName}}"}, {"{{name}}"}, {"{{category}}"},{" "}
              {"{{website}}"}. HTML emails support embedded images and table layouts.
            </p>
          </div>

          {activeChannel === "EMAIL" && emailFormat === "HTML" && content.trim() ? (
            <div>
              <label className="label">HTML preview</label>
              <iframe
                title="Email HTML preview"
                sandbox=""
                srcDoc={content}
                className="h-[420px] w-full rounded-lg border border-neutral-200 bg-white"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveTemplate()}
              disabled={saving || !canSave}
              className="btn btn-primary"
            >
              <Save className="h-4 w-4" />
              {saving
                ? "Saving..."
                : editingTemplateId
                  ? "Update template"
                  : "Create template"}
            </button>
            {editingTemplateId ? (
              <button
                type="button"
                onClick={() => resetForm(activeChannel)}
                className="btn btn-ghost"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </section>

        <section className="card card-pad space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-label">
                {activeChannel === "WHATSAPP" ? "WhatsApp" : "Email"} templates
              </p>
              <h2 className="text-lg font-semibold text-neutral-900">
                Saved templates
              </h2>
            </div>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
              {loading ? "Loading..." : `${activeTemplates.length} saved`}
            </span>
          </div>

          {loading ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              Loading templates...
            </div>
          ) : activeTemplates.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {activeTemplates.map((template) => {
                const html = isHtmlEmailBody(template.content);
                return (
                  <article
                    key={template.id}
                    className="rounded-lg border border-neutral-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-neutral-900">
                            {template.name}
                          </h3>
                          {html ? (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                              HTML
                            </span>
                          ) : null}
                        </div>
                        {template.subject ? (
                          <p className="mt-1 truncate text-sm text-neutral-600">
                            {template.subject}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => editTemplate(template)}
                        className="btn btn-secondary text-xs"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </div>
                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-neutral-600">
                      {summarizeEmailBody(template.content, 220)}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
              No {activeChannel === "WHATSAPP" ? "WhatsApp" : "Email"} templates yet.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
