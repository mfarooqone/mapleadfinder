"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  state: "success" | "warning" | "pending" | "processing";
  meta: string;
};

type ActivityJobsPanelProps = {
  items: ActivityItem[];
  onRefresh: () => void;
  refreshing?: boolean;
};

const stateConfig = {
  success: {
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-amber-100 text-amber-700",
  },
  pending: {
    icon: Clock3,
    className: "bg-slate-200 text-slate-700",
  },
  processing: {
    icon: LoaderCircle,
    className: "bg-sky-100 text-sky-700",
  },
} as const;

export default function ActivityJobsPanel({
  items,
  onRefresh,
  refreshing = false,
}: ActivityJobsPanelProps) {
  return (
    <div className="section-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Backend Activity
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Dashboard-side health summary
          </h2>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50"
        >
          <RefreshCw
            className={`h-4 w-4 text-emerald-600 ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          Refresh
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => {
          const config = stateConfig[item.state];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${config.className}`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      item.state === "processing" ? "animate-spin" : ""
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                      {item.meta}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
