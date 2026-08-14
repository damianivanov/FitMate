import { LuImageUp, LuLoaderCircle, LuPencil, LuTrash2 } from "react-icons/lu";
import Avatar from "@/components/Avatar";
import { ActionMenu, type ActionMenuItem } from "@/shared/components";
import { tick } from "@/shared/utils/haptics";
import { useProfileAvatar } from "../hooks/useProfileAvatar";

type ProfileAvatarPickerProps = {
  userId: number;
  initials: string;
};

/**
 * The picture is its own control: you change it by pressing the thing you are changing, rather
 * than by hunting for a file field further down the form. Removing is a second-order action,
 * so it lives behind the pencil instead of sitting under the avatar where it competes with it.
 */
export function ProfileAvatarPicker({ userId, initials }: ProfileAvatarPickerProps) {
  const { state, actions, fileInputRef } = useProfileAvatar();

  const items: ActionMenuItem[] = [
    {
      key: "change",
      label: state.hasAvatar ? "Change photo" : "Upload a photo",
      icon: <LuImageUp className="h-4 w-4 shrink-0" />,
      onSelect: () => {
        tick();
        actions.pickFile();
      },
      variant: "primary",
      disabled: state.isBusy,
    },
  ];

  if (state.hasAvatar) {
    items.push({
      key: "remove",
      label: "Remove photo",
      icon: <LuTrash2 className="h-4 w-4 shrink-0" />,
      onSelect: actions.remove,
      variant: "danger",
      disabled: state.isBusy,
    });
  }

  return (
    <div className="pf-avatar">
      <Avatar userId={userId} initials={initials} imageUrl={state.avatarUrl} size="xl" />

      <ActionMenu
        items={items}
        triggerAriaLabel="Picture options"
        triggerClassName="pf-avatar-edit"
        triggerContent={
          state.isBusy ? (
            <LuLoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <LuPencil className="h-4 w-4" />
          )
        }
        menuWidthClassName="w-48"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={actions.upload}
        className="sr-only"
        tabIndex={-1}
      />

      {state.error ? (
        <p role="alert" className="pf-avatar-error">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
