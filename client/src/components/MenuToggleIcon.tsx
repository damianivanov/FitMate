type MenuToggleIconProps = {
  isOpen: boolean;
};

export default function MenuToggleIcon({ isOpen }: MenuToggleIconProps) {
  return (
    <span className={`app-menu-icon ${isOpen ? "is-open" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
