"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANDING_FAQ } from "../marketing-data";

export default function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="landing-section">
      <div className="landing-container max-w-3xl">
        <div className="text-center">
          <p className="section-label">FAQ</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Common questions
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {LANDING_FAQ.map((item, index) => {
            const open = openIndex === index;
            return (
              <div key={item.question} className="landing-faq-item">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                >
                  <span className="font-medium text-neutral-900">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open ? (
                  <div className="border-t border-neutral-100 px-5 pb-4 pt-2">
                    <p className="text-sm leading-relaxed text-neutral-600">{item.answer}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
