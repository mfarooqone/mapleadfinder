"use client";

import { Star } from "lucide-react";
import type { ReactNode } from "react";
import MapLeadFinderLogo from "./MapLeadFinderLogo";
import { LANDING_REVIEWS, TRUST_STATS } from "./marketing-data";

type AuthLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle: string;
};

const featuredReview = LANDING_REVIEWS[0];

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <aside className="auth-layout-panel hidden lg:flex lg:flex-col lg:justify-between">
        <div>
          <MapLeadFinderLogo href="/" variant="light" size="lg" />
          <p className="mt-8 max-w-sm text-lg font-medium leading-relaxed text-emerald-50">
            Scrape Google Maps leads and run WhatsApp outreach from one Apollo-style
            workspace.
          </p>
          <div className="mt-8 grid max-w-sm grid-cols-2 gap-3">
            <div>
              <p className="text-2xl font-bold text-white">{TRUST_STATS.leadsScraped}</p>
              <p className="text-xs font-medium text-emerald-100">Leads scraped</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{TRUST_STATS.avgRating} ★</p>
              <p className="text-xs font-medium text-emerald-100">User rating</p>
            </div>
          </div>
        </div>
        <blockquote className="rounded-lg border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
          <div className="flex gap-0.5">
            {Array.from({ length: featuredReview.rating }).map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-emerald-50">
            &ldquo;{featuredReview.quote}&rdquo;
          </p>
          <footer className="mt-3 text-xs text-emerald-100">
            — {featuredReview.name}, {featuredReview.company}
          </footer>
        </blockquote>
      </aside>
      <div className="auth-layout-form flex flex-1 flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <MapLeadFinderLogo href="/" size="md" />
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
            <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
