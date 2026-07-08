"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import type { OnboardingStep } from "./marketing-data";

type DashboardOnboardingProps = {
  steps: OnboardingStep[];
};

export default function DashboardOnboarding({ steps }: DashboardOnboardingProps) {
  const completed = steps.filter((s) => s.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <section className="card card-pad h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <p className="section-label">Getting started</p>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">
            Launch your pipeline
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {completed} of {steps.length} steps complete
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {progress}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="mt-5 space-y-3">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                step.done
                  ? "border-emerald-100 bg-emerald-50/50"
                  : "border-neutral-200 hover:border-emerald-200 hover:bg-emerald-50/30"
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-300" />
              )}
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${step.done ? "text-emerald-900" : "text-neutral-900"}`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-neutral-500">{step.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
