import { NavLink, Outlet } from "react-router";
import { LuDumbbell, LuUserRound } from "react-icons/lu";
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
    "liquid-nav-item inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold lg:flex-none";
  const stateClassName = isActive ? "liquid-nav-item-active" : "";

  return `${baseClassName} ${stateClassName}`.trim();
}

export default function Profile() {
  const { state } = useProfilePage();
  const { user, displayName, hasName, initials, avatarColorClassName } = state;

  return (
    <>
      <header className="liquid-page-header px-4 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-extrabold shadow-lg ${avatarColorClassName}`}>
              {initials}
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                {displayName}
              </h1>
              {hasName && user.email ? (
                <span className="truncate text-sm font-medium text-secondary">{user.email}</span>
              ) : null}
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
        <div className="mx-auto min-w-0 max-w-3xl">
          <Outlet />
        </div>
      </PageBody>
    </>
  );
}
