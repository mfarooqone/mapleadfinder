"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { LANDING_PRICING } from "../marketing-data";

export default function LandingPricing() {
  return (
    <section id="pricing" className="landing-section landing-section-alt">
      <div className="landing-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">Pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Simple plans that scale with your pipeline
          </h2>
          <p className="mt-4 text-neutral-600">
            Start free. Upgrade once and keep daily campaigns running.
          </p>
          <p className="mt-2 text-xs font-medium text-emerald-700">
            Pro is a one-time $20 lifetime payment.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-2">
          {LANDING_PRICING.map((tier) => (
            <article
              key={tier.id}
              className={`landing-pricing-card ${tier.highlighted ? "landing-pricing-highlight" : ""}`}
            >
              {tier.highlighted ? (
                <span className="landing-pricing-badge">Lifetime deal</span>
              ) : null}
              <h3 className="text-lg font-semibold text-neutral-900">{tier.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-neutral-900">
                  ${tier.price}
                </span>
                <span className="text-sm text-neutral-500">/{tier.period}</span>
              </div>
              {tier.note ? (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  {tier.note}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-neutral-600">{tier.description}</p>
              <ul className="mt-6 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-neutral-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`btn mt-8 w-full ${tier.highlighted ? "btn-primary" : "btn-secondary"}`}
              >
                {tier.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
