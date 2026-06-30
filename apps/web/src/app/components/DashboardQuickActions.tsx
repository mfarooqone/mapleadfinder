"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Mail,
  MapPinned,
  MessageSquare,
  Mic,
  Search,
  Send,
  Users,
} from "lucide-react";

const actions: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    href: "/dashboard/scraper",
    title: "Find leads",
    description: "Scrape Google Maps by keyword & city",
    icon: MapPinned,
    accent: "from-sky-500 to-blue-600",
  },
  {
    href: "/dashboard/leads",
    title: "Search database",
    description: "Filter, export, and enrich contacts",
    icon: Search,
    accent: "from-violet-500 to-purple-600",
  },
  {
    href: "/dashboard/whatsapp",
    title: "Send campaign",
    description: "Bulk WhatsApp with warm-up guards",
    icon: Send,
    accent: "from-emerald-500 to-teal-600",
  },
  {
    href: "/dashboard/email",
    title: "Email outreach",
    description: "SMTP bulk send & AI drafts",
    icon: Mail,
    accent: "from-orange-500 to-amber-600",
  },
  {
    href: "/dashboard/contacts",
    title: "Import contacts",
    description: "CSV upload & manual entries",
    icon: Users,
    accent: "from-pink-500 to-rose-600",
  },
  {
    href: "/dashboard/whatsapp/voice",
    title: "Voice messages",
    description: "Send personalized audio notes",
    icon: Mic,
    accent: "from-cyan-500 to-sky-600",
  },
];

export default function DashboardQuickActions() {
  return (
    <section>
      <p className="section-label">Quick actions</p>
      <h2 className="mt-1 text-lg font-semibold text-neutral-900">
        What do you want to do?
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="dashboard-action-card group"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${action.accent} text-white shadow-sm`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-3">
                <p className="font-semibold text-neutral-900 group-hover:text-emerald-800">
                  {action.title}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">{action.description}</p>
              </div>
              <MessageSquare className="absolute bottom-4 right-4 h-4 w-4 text-neutral-200 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
