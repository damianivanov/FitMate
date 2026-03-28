type FeatureCardProps = {
  title: string;
  description: string;
};

export function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="liquid-surface liquid-hover-lift cursor-pointer rounded-2xl p-4 transition duration-200">
      <h3 className="m-0 mb-1.5 font-extrabold text-foreground">{title}</h3>
      <p className="m-0 text-secondary text-sm leading-snug">{description}</p>
    </div>
  );
}

