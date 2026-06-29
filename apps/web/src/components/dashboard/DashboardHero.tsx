type DashboardHeroProps = {
  total: number;
  withWebsite: number;
  withPhone: number;
  withEmail: number;
};

export function DashboardHero({
  total,
  withWebsite,
  withPhone,
  withEmail,
}: DashboardHeroProps) {
  const stats = [
    ["Leads", total],
    ["Emails", withEmail],
    ["Websites", withWebsite],
    ["Phones", withPhone],
  ];

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#597568]">
          Google Maps lead scraper
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-[#14211b] sm:text-5xl">
          Find local businesses and export the results.
        </h1>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#d8ddd4] bg-white p-4">
            <p className="text-[#5e6c64]">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
