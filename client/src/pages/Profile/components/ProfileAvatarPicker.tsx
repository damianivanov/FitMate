import { LuCamera, LuLoaderCircle } from "react-icons/lu";
import Avatar from "@/components/Avatar";
import { tick } from "@/shared/utils/haptics";
import { useProfileAvatar } from "../hooks/useProfileAvatar";

type ProfileAvatarPickerProps = {
  userId: number;
  initials: string;
};

/**
 * The picture is its own control: you change it by pressing the thing you are changing, rather
 * than by hunting for a file field further down the form.
 */
export function ProfileAvatarPicker({ userId, initials }: ProfileAvatarPickerProps) {
  const { state, actions, fileInputRef } = useProfileAvatar();

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          tick();
          actions.pickFile();
        }}
        disabled={state.isBusy}
        className="app-avatar-edit liquid-press"
        aria-label={state.hasAvatar ? "Change your picture" : "Add a picture"}
      >
        <Avatar userId={userId} initials={initials} imageUrl={state.avatarUrl} size="xl" />

        <span className="app-avatar-edit-badge" aria-hidden="true">
          {state.isBusy ? (
            <LuLoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <LuCamera className="h-3 w-3" />
          )}
        </span>
      </button>

      {state.hasAvatar ? (
        <button
          type="button"
          onClick={actions.remove}
          disabled={state.isBusy}
          className="text-[0.6875rem] font-semibold text-tertiary transition-colors hover:text-danger disabled:opacity-50"
        >
          Remove
        </button>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={actions.upload}
        className="sr-only"
        tabIndex={-1}
      />

      {state.error ? (
        <p role="alert" className="max-w-[10rem] text-center text-[0.6875rem] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
