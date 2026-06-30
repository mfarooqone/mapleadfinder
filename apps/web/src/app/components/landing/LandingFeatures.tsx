import {
  Database,
  Inbox,
  Mail,
  MapPinned,
  MessageSquare,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { LANDING_FEATURES } from "../marketing-data";

const iconMap: Record<string, LucideIcon> = {
  MapPinned,
  Database,
  MessageSquare,
  Shield,
  Mail,
  Inbox,
};

export default function LandingFeatures() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">Features</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Everything you need to find and close local leads
          </h2>
          <p className="mt-4 text-neutral-600">
            From Google Maps scraping to WhatsApp bulk send — one platform, like Apollo
            meets Lusha for local business outreach.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature) => {
            const Icon = iconMap[feature.icon] ?? MapPinned;
            return (
              <article key={feature.id} className="landing-feature-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
