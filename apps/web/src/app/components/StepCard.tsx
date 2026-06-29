import type { ReactNode } from "react";

type StepCardProps = {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export default function StepCard({
  step,
  title,
  description,
  children,
  actions,
}: StepCardProps) {
  return (
    <section className="card card-pad">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="step-heading">
            <span className="step-number">{step}</span>
            <p className="section-label">Step {step}</p>
          </div>
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          {description ? (
            <p className="page-subtitle mt-1 max-w-2xl">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
