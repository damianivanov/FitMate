type FeatureCardProps = {
  title: string;
  description: string;
};

export const FeatureCard = ({ title, description }: FeatureCardProps) => {
  return (
    <div className="liquid-surface cursor-pointer rounded-2xl p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(43,72,122,0.22)]">
      <h3 className="m-0 mb-1.5 font-extrabold text-slate-900">{title}</h3>
      <p className="m-0 text-slate-600 text-sm leading-snug">{description}</p>
    </div>
  );
};
