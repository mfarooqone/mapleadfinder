import { Quote, Star } from "lucide-react";
import { LANDING_REVIEWS } from "../marketing-data";

export default function LandingReviews() {
  return (
    <section id="reviews" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">Reviews</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Trusted by sales teams across MENA
          </h2>
          <p className="mt-4 text-neutral-600">
            See why teams switch from spreadsheets and scattered tools to MapLeadFinder.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_REVIEWS.map((review) => (
            <article key={review.id} className="landing-review-card">
              <Quote className="h-8 w-8 text-emerald-100" />
              <div className="mt-3 flex gap-0.5">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                &ldquo;{review.quote}&rdquo;
              </p>
              <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 pt-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                  {review.avatar}
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{review.name}</p>
                  <p className="text-xs text-neutral-500">
                    {review.role}, {review.company}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
