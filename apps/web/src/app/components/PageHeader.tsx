import type { ReactNode } from "react";
import Link from "next/link";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
};

export default function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: PageHeaderProps) {
  return (
    <header className="card card-pad flex flex-col gap-4 border-l-4 border-l-emerald-500 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="section-label mb-2">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}

export function PageLink({
  href,
  children,
  primary,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={primary ? "btn btn-primary" : "btn btn-secondary"}>
      {children}
    </Link>
  );
}
