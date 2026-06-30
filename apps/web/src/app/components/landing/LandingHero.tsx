import Link from "next/link";
import { ArrowRight, MapPin, MessageSquare, Star } from "lucide-react";
import { TRUSTED_COMPANIES } from "../marketing-data";

export default function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing-container grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="landing-hero-badge">
            Google Maps leads + WhatsApp outreach
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Find local businesses.
            <span className="block text-emerald-600">Message them on WhatsApp.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
            MapLeadFinder scrapes Google Maps, builds your lead database, and runs
            safe WhatsApp campaigns — the all-in-one tool for B2B teams in MENA and
            beyond.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-primary px-6 py-3 text-base">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn btn-secondary px-6 py-3 text-base">
              Open dashboard
            </Link>
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            No credit card · Setup in 5 minutes · WAHA QR connect
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {TRUSTED_COMPANIES.slice(0, 4).map((company) => (
              <span
                key={company}
                className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs font-medium text-neutral-600"
              >
                {company}
              </span>
            ))}
          </div>
        </div>

        <div className="landing-hero-mockup" aria-hidden="true">
          <div className="landing-mockup-window">
            <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs text-neutral-400">MapLeadFinder — Dashboard</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-800">Total leads</p>
                  <p className="text-2xl font-bold text-emerald-900">2,840</p>
                  <p className="text-xs text-emerald-600">+24% this week</p>
                </div>
                <div className="flex-1 rounded-lg bg-sky-50 p-3">
                  <p className="text-xs font-medium text-sky-800">Replies</p>
                  <p className="text-2xl font-bold text-sky-900">412</p>
                  <p className="text-xs text-sky-600">18% reply rate</p>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Recent scrapes
                </p>
                {[
                  { name: "Al Noor Auto Parts", city: "Riyadh", rating: 4.8 },
                  { name: "Gulf Steel Traders", city: "Dubai", rating: 4.6 },
                  { name: "Desert Logistics Co", city: "Jeddah", rating: 4.9 },
                ].map((lead) => (
                  <div
                    key={lead.name}
                    className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{lead.name}</p>
                      <p className="flex items-center gap-1 text-xs text-neutral-500">
                        <MapPin className="h-3 w-3" />
                        {lead.city}
                      </p>
                    </div>
                    <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {lead.rating}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
                <MessageSquare className="h-4 w-4 shrink-0" />
                Campaign sent to 48 warm leads · 12 replies
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
