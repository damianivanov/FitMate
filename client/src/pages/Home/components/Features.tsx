import { FeatureCard } from "@/shared/components";

export default function Features() {
  const features = [
    {
      title: "Member profiles",
      description: "Create and manage member accounts with clear profile ownership.",
    },
    {
      title: "Role-based access",
      description: "Admin, coach, and member permissions are enforced across the app.",
    },
    {
      title: "Secure sessions",
      description: "JWT access tokens with refresh flow and backend error tracking.",
    },
  ];

  return (
    <section className="mt-8" id="features">
      <h2 className="m-0 mb-1 text-2xl md:text-3xl font-extrabold text-primary">Why FitMate</h2>
      <p className="mb-4 text-sm text-secondary">Built as a clean baseline for secure, role-aware fitness workflows.</p>
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
        {features.map((feature, index) => (
          <FeatureCard
            key={index}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
    </section>
  );
}

