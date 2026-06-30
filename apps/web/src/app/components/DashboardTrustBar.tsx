"use client";

import { Star } from "lucide-react";
import { DASHBOARD_REVIEWS, TRUST_STATS, TRUSTED_COMPANIES } from "./marketing-data";

export default function DashboardTrustBar() {
  return (
    <section className="dashboard-trust-bar">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {DASHBOARD_REVIEWS.slice(0, 4).map((review) => (
              <span
                key={review.id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white"
                title={review.name}
              >
                {review.avatar}
              </span>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-1 text-sm font-semibold text-neutral-900">
                {TRUST_STATS.avgRating}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              {TRUST_STATS.users} sales teams worldwide
            </p>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-neutral-200 sm:block" />

        <div className="flex flex-wrap gap-2">
          {TRUSTED_COMPANIES.map((company) => (
            <span
              key={company}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600"
            >
              {company}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
