"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";

type LogoVariant = "default" | "light" | "onDark";
type LogoSize = "sm" | "md" | "lg";

type MapLeadFinderLogoProps = {
  variant?: LogoVariant;
  size?: LogoSize;
  showWordmark?: boolean;
  tagline?: string;
  href?: string;
  className?: string;
};

const boxSizes: Record<LogoSize, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-xl",
  lg: "h-10 w-10 rounded-xl",
};

const wordmarkSizes: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-xl",
};

function LogoMark({
  variant,
  size,
  gradientId,
}: {
  variant: LogoVariant;
  size: LogoSize;
  gradientId: string;
}) {
  const iconScale = size === "sm" ? 0.78 : size === "md" ? 0.88 : 1;

  if (variant === "light") {
    return (
      <span
        className={`${boxSizes[size]} flex shrink-0 items-center justify-center bg-white/20 shadow-sm backdrop-blur-sm`}
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="text-white"
          style={{ width: `${18 * iconScale}px`, height: `${18 * iconScale}px` }}
          fill="none"
        >
          <path
            d="M17 8.5a5.5 5.5 0 0 0-7.78 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M19 6.2a8 8 0 0 0-11.31 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M12 21s6-5.6 6-10a6 6 0 1 0-12 0c0 4.4 6 10 6 10z"
            fill="currentColor"
          />
          <circle cx="12" cy="11" r="2.1" fill="#047857" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`${boxSizes[size]} flex shrink-0 items-center justify-center shadow-sm`}
      style={{
        background: `linear-gradient(135deg, #10b981 0%, #0d9488 100%)`,
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: `${18 * iconScale}px`, height: `${18 * iconScale}px` }}
        fill="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="4" y1="4" x2="20" y2="20">
            <stop stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ecfdf5" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path
          d="M17 8.5a5.5 5.5 0 0 0-7.78 0"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M19 6.2a8 8 0 0 0-11.31 0"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path d="M12 21s6-5.6 6-10a6 6 0 1 0-12 0c0 4.4 6 10 6 10z" fill={`url(#${gradientId})`} />
        <circle cx="12" cy="11" r="2.1" fill="#059669" />
      </svg>
    </span>
  );
}

function Wordmark({
  variant,
  size,
  tagline,
}: {
  variant: LogoVariant;
  size: LogoSize;
  tagline?: string;
}) {
  const titleClass =
    variant === "light"
      ? "font-bold tracking-tight text-white"
      : variant === "onDark"
        ? "font-bold tracking-tight text-neutral-50"
        : "font-bold tracking-tight text-neutral-900";

  const leadClass =
    variant === "light"
      ? "text-emerald-100"
      : variant === "onDark"
        ? "text-emerald-400"
        : "text-emerald-600";

  const taglineClass =
    variant === "light"
      ? "text-[11px] text-emerald-100"
      : variant === "onDark"
        ? "text-[11px] text-neutral-400"
        : "text-[11px] text-neutral-500";

  return (
    <div className="min-w-0">
      <p className={`${wordmarkSizes[size]} ${titleClass} leading-tight`}>
        Map<span className={leadClass}>Lead</span>Finder
      </p>
      {tagline ? <p className={taglineClass}>{tagline}</p> : null}
    </div>
  );
}

function LogoContent({
  variant,
  size,
  showWordmark,
  tagline,
  gradientId,
}: {
  variant: LogoVariant;
  size: LogoSize;
  showWordmark: boolean;
  tagline?: string;
  gradientId: string;
}) {
  return (
    <>
      <LogoMark variant={variant} size={size} gradientId={gradientId} />
      {showWordmark ? <Wordmark variant={variant} size={size} tagline={tagline} /> : null}
    </>
  );
}

export default function MapLeadFinderLogo({
  variant = "default",
  size = "md",
  showWordmark = true,
  tagline,
  href = "/",
  className = "",
}: MapLeadFinderLogoProps) {
  const gradientId = useId().replace(/:/g, "");
  const resolvedVariant = variant === "onDark" ? "onDark" : variant;

  const content = (
    <LogoContent
      variant={resolvedVariant}
      size={size}
      showWordmark={showWordmark}
      tagline={tagline}
      gradientId={gradientId}
    />
  );

  const wrap = (children: ReactNode) => (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>{children}</span>
  );

  if (href) {
    return (
      <Link href={href} className={`inline-flex items-center gap-2.5 ${className}`}>
        {content}
      </Link>
    );
  }

  return wrap(content);
}
