"use client";

import Link from "next/link";
import MapLeadFinderLogo from "../MapLeadFinderLogo";

const footerLinks = {
  Product: [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#reviews", label: "Reviews" },
    { href: "#faq", label: "FAQ" },
  ],
  Account: [
    { href: "/login", label: "Sign in" },
    { href: "/signup", label: "Create account" },
    { href: "/dashboard", label: "Dashboard" },
  ],
};

export default function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-container py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <MapLeadFinderLogo href="/" variant="onDark" size="sm" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              Google Maps lead generation and WhatsApp outreach for modern B2B teams.
            </p>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <p className="text-sm font-semibold text-neutral-900">{title}</p>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-500 transition-colors hover:text-emerald-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-400">
          © {new Date().getFullYear()} MapLeadFinder. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
