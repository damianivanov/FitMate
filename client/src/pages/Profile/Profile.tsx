import { Outlet } from "react-router";
import { NativeCard, NativePage, PageBody, PageIntro } from "@/shared/components";
import { ProfileAvatarPicker } from "./components/ProfileAvatarPicker";
import { ProfileSectionNav } from "./components/ProfileSectionNav";
import { useProfilePage } from "./hooks/useProfilePage";
import "./profile.css";

export default function Profile() {
  const { state } = useProfilePage();
  const { user, displayName, hasName, initials } = state;

  return (
    <PageBody>
      <NativePage className="pf-page">
        <PageIntro eyebrow="Your account" title="Profile" />

        <div className="pf-sidebar">
          <NativeCard className="pf-hero">
            <ProfileAvatarPicker userId={user.id} initials={initials} />
            <div className="pf-hero-copy">
              <b>{displayName}</b>
              {hasName && user.email ? <small>{user.email}</small> : null}
            </div>
          </NativeCard>

          <ProfileSectionNav />
        </div>

        <div className="min-w-0">
          <Outlet />
        </div>
      </NativePage>
    </PageBody>
  );
}
