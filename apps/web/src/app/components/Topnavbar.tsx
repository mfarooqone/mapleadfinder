"use client";

import { useEffect, useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
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
    : authUser?.email?.slice(0, 2).toUpperCase() ?? "WA";

  const handleLogout = () => {
    clearAuthSession();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0 xl:hidden">
          <p className="truncate text-sm font-semibold text-neutral-900">
            WhatsApp Agent
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="btn btn-secondary"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white pl-1 pr-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium text-neutral-900">
                {authUser?.name || authUser?.email || "User"}
              </p>
              <p className="text-xs text-neutral-500">
                {authUser?.role === "ADMIN" ? "Admin" : "User"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
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
