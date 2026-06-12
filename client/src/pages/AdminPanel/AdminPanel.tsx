import { Link } from "react-router";

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
  {
    to: "/management/users",
    title: "User Grid",
    description: "Search users, change roles, and activate or remove accounts.",
  },
  {
    to: "/management/errors",
    title: "Error Grid",
    description: "Inspect server-side errors, view stack traces, and clear the log.",
  },
] as const;

export default function AdminPanel() {
  return (
    <div className="w-full flex-1 p-3 pt-8 md:p-8">
      <div className="liquid-surface rounded-3xl p-3 md:p-6">
        <header className="space-y-2 py-5 px-3 rounded-xl">
          <h1 className="text-3xl font-extrabold text-primary">Admin Dashboard</h1>
          <p className="text-sm text-secondary">Central place for management grids and tools.</p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {gridLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="liquid-pill block rounded-2xl p-4 transition hover:-translate-y-0.5"
            >
              <p className="text-base font-semibold text-primary">{item.title}</p>
              <p className="mt-1 text-sm text-secondary">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

