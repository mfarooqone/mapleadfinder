"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  XCircle,
} from "lucide-react";
import type { TemplateRecord } from "@/lib/backend";

type TemplatesGridProps = {
  templates: TemplateRecord[];
};

function getCategoryTone(category: string) {
  switch (category.toUpperCase()) {
    case "MARKETING":
      return "bg-amber-100 text-amber-700";
    case "UTILITY":
      return "bg-sky-100 text-sky-700";
    case "AUTH":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function getStatusMeta(status: string) {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return {
        label: "Approved",
        className: "bg-emerald-100 text-emerald-700",
        Icon: CheckCircle2,
      };
    case "PENDING":
    case "PENDING_APPROVAL":
      return {
        label: "Pending",
        className: "bg-amber-100 text-amber-700",
        Icon: Clock3,
      };
    default:
      return {
        label: "Rejected",
        className: "bg-rose-100 text-rose-700",
        Icon: XCircle,
      };
  }
}

export default function TemplatesGrid({ templates }: TemplatesGridProps) {
  const [filter, setFilter] = useState<"ALL" | "APPROVED" | "PENDING" | "REJECTED">(
    "ALL",
  );
  const [previewId, setPreviewId] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const status = template.status.toUpperCase();
      return filter === "ALL" || status === filter || (filter === "PENDING" && status === "PENDING_APPROVAL");
    });
  }, [filter, templates]);

  return (
    <div className="rounded-[30px] border border-emerald-100 bg-white/95 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
            Templates
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Approved content library
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Use approved templates for first-touch outreach and for the 24-hour
            policy boundary.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["ALL", "APPROVED", "PENDING", "REJECTED"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                filter === item
                  ? "bg-emerald-600 text-white shadow-[0_10px_24px_rgba(31,175,90,0.22)]"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {item.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredTemplates.map((template) => {
            const status = getStatusMeta(template.status);
            const StatusIcon = status.Icon;
            const isExpanded = previewId === template.id;

            return (
              <article
                key={template.id}
                className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(247,251,248,0.86))] p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getCategoryTone(template.category)}`}
                    >
                      {template.channel ?? "WHATSAPP"} · {template.category}
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      {template.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Language: {template.language}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/80 p-4">
                  {template.subject ? (
                    <p className="mb-2 text-sm font-semibold text-slate-800">
                      {template.subject}
                    </p>
                  ) : null}
                  <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                    {template.content}
                  </p>
                </div>

                {isExpanded ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Full preview
                    </p>
                    {template.subject ? (
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {template.subject}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {template.content}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <FileText className="h-4 w-4" />
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </div>
                  <button
                    onClick={() =>
                      setPreviewId(isExpanded ? null : template.id)
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Eye className="h-4 w-4" />
                    {isExpanded ? "Hide preview" : "Preview"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-emerald-200 bg-emerald-50/50 px-6 py-14 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-white shadow-sm">
            <FileText className="h-7 w-7 text-emerald-600" />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-slate-900">
            No templates in this state
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
            Create or sync templates in the backend and they will appear here
            with approval status for compliant WhatsApp sending.
          </p>
        </div>
      )}
    </div>
  );
}
