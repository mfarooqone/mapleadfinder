"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import MapLeadFinderLogo from "../MapLeadFinderLogo";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#reviews", label: "Reviews" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="landing-nav">
      <div className="landing-container flex items-center justify-between py-4">
        <MapLeadFinderLogo href="/" size="md" />

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-emerald-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="btn btn-ghost text-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary text-sm">
            Start free
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-neutral-600 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-neutral-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-neutral-700"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link href="/login" className="btn btn-secondary text-sm">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary text-sm">
              Start free
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
