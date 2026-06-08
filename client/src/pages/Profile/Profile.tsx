import { NavLink, Outlet } from "react-router-dom";
import { LuDumbbell, LuMail, LuShieldCheck, LuUserRound } from "react-icons/lu";
import { PageBody } from "@/shared/components";
import { useProfilePage } from "./hooks/useProfilePage";

const profileNavItems = [
  {
    label: "Account",
    to: ".",
    icon: LuUserRound,
    end: true,
  },
  {
    label: "My Exercises",
    to: "exercises",
    icon: LuDumbbell,
    end: false,
  },
];

function getProfileNavLinkClassName(isActive: boolean): string {
  const baseClassName =
    "liquid-nav-item inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold";
  const stateClassName = isActive ? "liquid-nav-item-active" : "";

  return `${baseClassName} ${stateClassName}`.trim();
}

export default function Profile() {
  const { state } = useProfilePage();
  const { user, displayName, initials, avatarColorClassName, roleLabel } = state;

  return (
    <>
      <header className="liquid-page-header px-4 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-extrabold shadow-lg ${avatarColorClassName}`}>
              {initials}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                {displayName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-secondary">
                {user.email ? (
                  <span className="liquid-chip inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1">
                    <LuMail className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{user.email}</span>
                  </span>
                ) : null}
                <span className="liquid-chip inline-flex items-center gap-2 rounded-full px-3 py-1">
                  <LuShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          <nav
            aria-label="Profile sections"
            className="liquid-pill flex w-full gap-2 rounded-full p-1 lg:w-auto"
          >
            {profileNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => getProfileNavLinkClassName(isActive)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <PageBody>
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
          <aside className="liquid-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${avatarColorClassName}`}>
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-secondary">{roleLabel}</p>
              </div>
            </div>

            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-widest text-tertiary">
                  Email
                </dt>
                <dd className="mt-1 truncate font-medium text-foreground">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-widest text-tertiary">
                  User ID
                </dt>
                <dd className="mt-1 font-medium text-foreground">{user.id}</dd>
              </div>
            </dl>
          </aside>

          <section className="min-w-0 lg:col-span-2">
            <Outlet />
          </section>
        </div>
      </PageBody>
    </>
  );
}
