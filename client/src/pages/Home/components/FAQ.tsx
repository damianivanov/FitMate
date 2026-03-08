import { FeatureCard } from "@/shared/components";

export default function FAQ() {
  const faqs = [
    {
      title: "Is this the first release?",
      description: "Yes. This version focuses on users, authentication, and role setup for FitMate.",
    },
    {
      title: "Are roles already available?",
      description: "Yes. Default roles are seeded and attached to the authorization flow.",
    },
    {
      title: "Can I add workout modules later?",
      description: "Yes. The current structure is ready for adding workouts, plans, and progress modules incrementally.",
    },
  ];

  return (
    <section className="mt-8" id="faq">
      <h2 className="m-0 mb-1 text-2xl md:text-3xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
      <p className="mb-4 text-sm text-slate-600">Quick answers about scope, roles, and extensibility.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {faqs.map((faq, index) => (
          <FeatureCard
            key={index}
            title={faq.title}
            description={faq.description}
          />
        ))}
      </div>
    </section>
  );
}
