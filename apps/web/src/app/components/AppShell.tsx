"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopNavbar from "./Topnavbar";

type AppShellProps = {
  children: ReactNode;
  onRefresh: () => void;
  refreshing?: boolean;
  contentClassName?: string;
};

export default function AppShell({
  children,
  onRefresh,
  refreshing = false,
  contentClassName = "max-w-7xl",
}: AppShellProps) {
  return (
    <div className="app-shell flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar onRefresh={onRefresh} refreshing={refreshing} />
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 xl:pb-6">
          <div className={`mx-auto w-full space-y-6 ${contentClassName}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
