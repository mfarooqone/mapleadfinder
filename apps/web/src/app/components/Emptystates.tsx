"use client";

import { MessageSquare, Users, FileText, Megaphone, Zap } from "lucide-react";

type EmptyStateVariant = "conversations" | "leads" | "templates" | "campaigns" | "generic";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const variants: Record<
  EmptyStateVariant,
  { icon: React.ElementType; title: string; description: string; ctaLabel: string }
> = {
  conversations: {
    icon: MessageSquare,
    title: "No conversations yet",
    description: "Incoming WhatsApp messages will appear here.",
    ctaLabel: "Send a test message",
  },
  leads: {
    icon: Users,
    title: "No leads yet",
    description: "Add contacts or import a CSV to get started.",
    ctaLabel: "Add contacts",
  },
  templates: {
    icon: FileText,
    title: "No templates yet",
    description: "Create message templates for outreach.",
    ctaLabel: "New template",
  },
  campaigns: {
    icon: Megaphone,
    title: "No campaigns yet",
    description: "Run bulk outreach from the WhatsApp setup page.",
    ctaLabel: "Go to setup",
  },
  generic: {
    icon: Zap,
    title: "Nothing here yet",
    description: "Get started with an action below.",
    ctaLabel: "Get started",
  },
};

export default function EmptyState({
  variant = "generic",
  title,
  description,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const cfg = variants[variant];
  const Icon = cfg.icon;

  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white border border-neutral-200">
        <Icon className="h-5 w-5 text-neutral-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-medium text-neutral-900">
        {title ?? cfg.title}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        {description ?? cfg.description}
      </p>
      {onCta ? (
        <button type="button" onClick={onCta} className="btn btn-primary mt-5">
          {ctaLabel ?? cfg.ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
