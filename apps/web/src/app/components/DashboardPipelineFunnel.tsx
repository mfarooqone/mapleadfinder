"use client";

import { TrendingUp } from "lucide-react";

type PipelineStage = {
  label: string;
  value: number;
  pct: number;
  color: string;
};

type DashboardPipelineFunnelProps = {
  stages: PipelineStage[];
};

export default function DashboardPipelineFunnel({
  stages,
}: DashboardPipelineFunnelProps) {
  return (
    <section className="card card-pad h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">Pipeline funnel</p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-900">
            Lead → Engaged
          </h2>
        </div>
        <span className="badge badge-success">
          <TrendingUp className="h-3 w-3" />
          +18% vs last week
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {stages.map((stage, index) => (
          <div key={stage.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-700">{stage.label}</span>
              <span className="tabular-nums text-neutral-900">
                {stage.value.toLocaleString()}
                <span className="ml-2 text-xs text-neutral-400">{stage.pct}%</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full ${stage.color} transition-all duration-700`}
                style={{
                  width: `${Math.max(stage.pct, index === 0 ? 100 : 4)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-neutral-500">
        Track how scraped Google Maps leads move through contact, outreach, and
        reply stages — similar to Apollo and Lusha pipeline views.
      </p>
    </section>
  );
}
