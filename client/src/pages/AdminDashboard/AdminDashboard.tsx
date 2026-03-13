import { Link } from "react-router-dom";

const gridLinks = [
  {
    to: "/management/exercises",
    title: "Exercise Grid",
    description: "Manage global exercises and open create/edit modals.",
  },
  {
    to: "/management/muscle-groups",
    title: "Muscle Group Grid",
    description: "Manage muscle group names and image URLs.",
  },
] as const;

export default function AdminDashboard() {
  return (
    <div className="w-full flex-1 px-5 py-8">
      <div className="mx-auto w-full max-w-[79dvw] space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-600">Central place for management grids and tools.</p>
        </header>

        <section className="liquid-surface rounded-3xl p-5 md:p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Grids</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {gridLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="liquid-pill block rounded-2xl p-4 transition hover:-translate-y-0.5"
              >
                <p className="text-base font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
