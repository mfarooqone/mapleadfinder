"use client";

import type { LucideIcon } from "lucide-react";

export type DashboardStatCard = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  bg: string;
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
          <div key={card.label} className="card card-pad">
            <div className="flex items-center justify-between gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: card.bg }}
              >
                <Icon className="h-4 w-4" style={{ color: card.accent }} />
              </div>
              {loading ? (
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
