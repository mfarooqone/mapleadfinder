"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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

const navSections = [
  {
    title: "Home",
    items: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Find leads",
    items: [
      { label: "Google Scraper", href: "/dashboard/scraper", icon: MapPinned },
      { label: "Lead database", href: "/dashboard/leads", icon: Users },
      { label: "Contacts", href: "/dashboard/contacts", icon: UserRoundPlus },
    ],
  },
  {
    title: "Outreach",
    items: [
      { label: "WhatsApp Setup", href: "/dashboard/whatsapp/setup", icon: QrCode },
      { label: "Campaigns", href: "/dashboard/whatsapp", icon: MessageSquare },
      { label: "Voice", href: "/dashboard/whatsapp/voice", icon: Mic },
      { label: "Email", href: "/dashboard/email", icon: Mail },
      { label: "Inbox", href: "/dashboard/conversations", icon: MessagesSquare },
      { label: "Email mailbox", href: "/dashboard/email/mailbox", icon: Inbox },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Templates", href: "/dashboard/templates", icon: Shapes },
      { label: "SMTP setup", href: "/dashboard/email/setup", icon: Mail },
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
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-emerald-600 text-white shadow-sm"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${active ? "text-emerald-100" : "text-neutral-400"}`}
      />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  const flatItems = navSections.flatMap((s) => s.items);

  return (
    <>
      <aside className="dashboard-sidebar hidden xl:flex xl:flex-col">
        <div className="border-b border-neutral-200/80 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-sm">
              ML
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight text-neutral-900">
                MapLeadFinder
              </p>
              <p className="text-[11px] text-neutral-500">Scrape · Enrich · Outreach</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
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
          <div className="rounded-xl bg-gradient-to-br from-violet-50 to-emerald-50 p-3">
            <p className="text-xs font-semibold text-neutral-800">Pro tip</p>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
              Warm up WhatsApp before bulk sends to protect your number.
            </p>
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-neutral-200 bg-white px-2 py-2 xl:hidden">
        {flatItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium ${
                active ? "text-emerald-700" : "text-neutral-500"
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
