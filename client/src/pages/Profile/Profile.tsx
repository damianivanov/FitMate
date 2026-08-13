import { Outlet } from "react-router";
import { PageBody } from "@/shared/components";
import { ProfileAvatarPicker } from "./components/ProfileAvatarPicker";
import { ProfileSectionNav } from "./components/ProfileSectionNav";
import { useProfilePage } from "./hooks/useProfilePage";

export default function Profile() {
  const { state } = useProfilePage();
  const { user, displayName, hasName, initials } = state;

  return (
    <>
      <header className="px-4 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ProfileAvatarPicker userId={user.id} initials={initials} />
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                {displayName}
              </h1>
              {hasName && user.email ? (
                <span className="truncate text-sm font-medium text-secondary">{user.email}</span>
              ) : null}
            </div>
          </div>

          <ProfileSectionNav />
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
