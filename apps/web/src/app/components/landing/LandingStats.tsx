import { TRUST_STATS } from "../marketing-data";

const stats = [
  { value: TRUST_STATS.users, label: "Sales teams" },
  { value: TRUST_STATS.leadsScraped, label: "Leads scraped" },
  { value: TRUST_STATS.messagesSent, label: "Messages sent" },
  { value: `${TRUST_STATS.avgRating} ★`, label: "Average rating" },
];

export default function LandingStats() {
  return (
    <section className="landing-stats">
      <div className="landing-container">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center md:text-left">
              <p className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-neutral-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
