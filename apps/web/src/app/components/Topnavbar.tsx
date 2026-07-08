"use client";

import { useEffect, useState } from "react";
import { Bell, LogOut, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import MapLeadFinderLogo from "./MapLeadFinderLogo";
import { clearAuthSession, getAuthUser, type AuthUser } from "@/lib/auth";

type TopNavbarProps = {
  onRefresh: () => void;
  refreshing?: boolean;
};

export default function TopNavbar({
  onRefresh,
  refreshing = false,
}: TopNavbarProps) {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setAuthUser(getAuthUser());
  }, []);

  const initials = authUser?.name
    ? authUser.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : authUser?.email?.slice(0, 2).toUpperCase() ?? "ML";

  const handleLogout = () => {
    clearAuthSession();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 xl:hidden">
          <MapLeadFinderLogo href="/dashboard" size="sm" />
        </div>

        <div className="relative hidden max-w-xl flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            placeholder="Search leads, contacts, conversations"
            className="input bg-neutral-50 pl-9 text-sm"
            readOnly
            onFocus={() => router.push("/dashboard/leads")}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-md border border-transparent text-neutral-400 hover:border-neutral-200 hover:bg-white hover:text-neutral-700 sm:flex"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="btn btn-secondary"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white py-1 pl-1 pr-2 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-44 truncate text-sm font-semibold text-neutral-900">
                {authUser?.name || authUser?.email || "User"}
              </p>
              <p className="text-xs text-neutral-500">
                {authUser?.role === "ADMIN" ? "Admin · Pro" : "Sales rep"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
