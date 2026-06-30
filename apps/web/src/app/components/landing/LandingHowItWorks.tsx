import { LANDING_STEPS } from "../marketing-data";

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="landing-section landing-section-alt">
      <div className="landing-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            From scrape to signed deal in four steps
          </h2>
        </div>
        <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {LANDING_STEPS.map((item) => (
            <li key={item.step} className="landing-step-card">
              <span className="landing-step-number">{item.step}</span>
              <h3 className="mt-4 text-lg font-semibold text-neutral-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
