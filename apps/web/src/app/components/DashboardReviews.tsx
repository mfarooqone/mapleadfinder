"use client";

import { Quote, Star, Trophy } from "lucide-react";
import { DASHBOARD_REVIEWS } from "./marketing-data";

export default function DashboardReviews() {
  return (
    <section className="dashboard-reviews-section">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Customer stories</p>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
            Loved by sales teams like yours
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Real-style feedback from teams using lead finder + WhatsApp outreach
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">
          <Trophy className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold text-amber-900">
            #1 rated on G2 — Lead Gen category
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_REVIEWS.map((review) => (
          <article
            key={review.id}
            className="dashboard-review-card group relative flex flex-col"
          >
            <Quote className="absolute right-4 top-4 h-8 w-8 text-emerald-100 transition-colors group-hover:text-emerald-200" />
            <div className="flex gap-1">
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-700">
              &ldquo;{review.quote}&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3 border-t border-neutral-100 pt-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                {review.avatar}
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{review.name}</p>
                <p className="text-xs text-neutral-500">
                  {review.role}, {review.company}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
