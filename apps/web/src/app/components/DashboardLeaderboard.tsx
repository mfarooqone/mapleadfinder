"use client";

import { Medal } from "lucide-react";
import { LEADERBOARD } from "./marketing-data";

export default function DashboardLeaderboard() {
  return (
    <section className="card card-pad h-full">
      <div className="flex items-center gap-2">
        <Medal className="h-4 w-4 text-amber-500" />
        <p className="section-label">Team leaderboard</p>
      </div>
      <h2 className="mt-2 text-lg font-semibold text-neutral-900">This month</h2>
      <p className="text-xs text-neutral-500">Leads scraped & replies received</p>

      <ul className="mt-5 space-y-2">
        {LEADERBOARD.map((entry) => (
          <li
            key={entry.rank}
            className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2.5"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                entry.rank === 1
                  ? "bg-amber-100 text-amber-800"
                  : entry.rank === 2
                    ? "bg-neutral-200 text-neutral-700"
                    : entry.rank === 3
                      ? "bg-orange-100 text-orange-800"
                      : "bg-white text-neutral-500"
              }`}
            >
              {entry.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">
                {entry.name}
              </p>
              <p className="text-xs text-neutral-500">
                {entry.leads.toLocaleString()} leads · {entry.replies} replies
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-600">{entry.trend}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
