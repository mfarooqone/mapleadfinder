"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

export type DashboardStatCard = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  bg: string;
  trend?: string;
  trendUp?: boolean;
};

type StatsCardsProps = {
  cards: DashboardStatCard[];
  loading?: boolean;
};

export default function StatsCards({ cards, loading = false }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="dashboard-stat-card">
            <div className="flex items-start justify-between gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: card.bg }}
              >
                <Icon className="h-5 w-5" style={{ color: card.accent }} />
              </div>
              {card.trend ? (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    card.trendUp !== false
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {card.trendUp !== false ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {card.trend}
                </span>
              ) : loading ? (
                <span className="text-xs text-neutral-400">…</span>
              ) : null}
            </div>
            <p className="stat-value mt-4">{card.value}</p>
            <p className="stat-label">{card.label}</p>
            <p className="stat-hint">{card.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
