"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AtSign,
  Inbox,
  LayoutDashboard,
  Mail,
  MapPinned,
  MessageSquare,
  MessagesSquare,
  Mic,
  QrCode,
  Shapes,
  UserRoundPlus,
  Users,
} from "lucide-react";
import MapLeadFinderLogo from "./MapLeadFinderLogo";

const navSections = [
  {
    title: "Home",
    items: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Find leads",
    items: [
      { label: "Scraper", href: "/dashboard/scraper", icon: MapPinned },
      { label: "Leads", href: "/dashboard/leads", icon: Users },
      { label: "Contacts", href: "/dashboard/contacts", icon: UserRoundPlus },
    ],
  },
  {
    title: "Outreach",
    items: [
      { label: "WhatsApp Setup", href: "/dashboard/whatsapp/setup", icon: QrCode },
      { label: "WhatsApp Campaigns", href: "/dashboard/whatsapp", icon: MessageSquare },
      { label: "Voice", href: "/dashboard/whatsapp/voice", icon: Mic },
      { label: "Email Campaigns", href: "/dashboard/email", icon: Mail },
      { label: "Inbox", href: "/dashboard/conversations", icon: MessagesSquare },
      { label: "Mailbox", href: "/dashboard/email/mailbox", icon: Inbox },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Templates", href: "/dashboard/templates", icon: Shapes },
      { label: "SMTP", href: "/dashboard/email/setup", icon: AtSign },
    ],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold transition-all ${
        active
          ? "border border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm"
          : "border border-transparent text-neutral-600 hover:bg-emerald-50/70 hover:text-emerald-800"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${
          active ? "text-emerald-600" : "text-neutral-400 group-hover:text-emerald-600"
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/dashboard") return false;

    const moreSpecificItemActive = navSections
      .flatMap((section) => section.items)
      .some(
        (item) =>
          item.href !== href &&
          item.href.startsWith(`${href}/`) &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`)),
      );

    return !moreSpecificItemActive && pathname.startsWith(`${href}/`);
  };

  const flatItems = navSections.flatMap((s) => s.items);

  return (
    <>
      <aside className="dashboard-sidebar hidden xl:flex xl:flex-col">
        <div className="border-b border-neutral-200/80 px-5 py-5">
          <MapLeadFinderLogo
            href="/"
            size="sm"
            tagline="Scrape · Enrich · Outreach"
          />
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={isActive(item.href)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-neutral-200/80 p-4">
          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-bold text-emerald-950">Warm-up mode</p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-emerald-800">
              Keep first messages short and pace campaigns for safer outreach.
            </p>
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-neutral-200 bg-white/95 px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur xl:hidden">
        {flatItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md py-2 text-[10px] font-semibold ${
                active ? "bg-emerald-50 text-emerald-700" : "text-neutral-500"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate px-1">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
