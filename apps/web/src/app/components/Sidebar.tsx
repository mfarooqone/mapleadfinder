"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  LayoutDashboard,
  Mail,
  MessageSquare,
  MessagesSquare,
  Mic,
  QrCode,
  Shapes,
  UserRoundPlus,
  Users,
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Scraper", href: "/dashboard/scraper", icon: Users },
  { label: "Contacts", href: "/dashboard/contacts", icon: UserRoundPlus },
  { label: "Leads", href: "/dashboard/leads", icon: Users },
  { label: "WhatsApp Setup", href: "/dashboard/whatsapp/setup", icon: QrCode },
  { label: "Send", href: "/dashboard/whatsapp", icon: MessageSquare },
  { label: "Email", href: "/dashboard/email", icon: Mail },
  { label: "Email Mailbox", href: "/dashboard/email/mailbox", icon: Inbox },
  { label: "SMTP Setup", href: "/dashboard/email/setup", icon: Mail },
  { label: "Voice", href: "/dashboard/whatsapp/voice", icon: Mic },
  { label: "Inbox", href: "/dashboard/conversations", icon: MessagesSquare },
  { label: "Templates", href: "/dashboard/templates", icon: Shapes },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-neutral-200 bg-white xl:flex xl:flex-col">
        <div className="border-b border-neutral-200 px-5 py-5">
          <p className="text-sm font-semibold text-neutral-900">Lead Outreach</p>
          <p className="mt-0.5 text-xs text-neutral-500">Scrape and WhatsApp outreach</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-green-50 text-green-800"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? "text-green-700" : "text-neutral-400"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-neutral-200 bg-white px-2 py-2 xl:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium ${
                active ? "text-green-700" : "text-neutral-500"
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
