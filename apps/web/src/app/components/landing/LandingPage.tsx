import LandingNavbar from "./LandingNavbar";
import LandingHero from "./LandingHero";
import LandingStats from "./LandingStats";
import LandingFeatures from "./LandingFeatures";
import LandingHowItWorks from "./LandingHowItWorks";
import LandingReviews from "./LandingReviews";
import LandingPricing from "./LandingPricing";
import LandingFaq from "./LandingFaq";
import LandingFooter from "./LandingFooter";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingReviews />
        <LandingPricing />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
