import { useState, type ReactNode } from "react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  type Placement,
} from "@floating-ui/react";
import { LuEllipsis } from "react-icons/lu";

const MENU_OFFSET_PX = 8;
const MENU_VIEWPORT_PADDING_PX = 8;
const MENU_ITEM_CLASS_NAME =
  "flex w-full cursor-pointer items-center justify-start gap-2 rounded-full bg-transparent px-3 py-2 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const DEFAULT_TRIGGER_CLASS_NAME =
  "liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground";

export type ActionMenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
};

const VARIANT_CLASS_NAME: Record<NonNullable<ActionMenuItem["variant"]>, string> = {
  default: "text-secondary hover:bg-white/8",
  primary: "text-primary hover:bg-primary-100/20",
  danger: "text-danger hover:bg-red-100/20",
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  triggerAriaLabel: string;
  triggerClassName?: string;
  menuWidthClassName?: string;
  placement?: Placement;
};

export function ActionMenu({
  items,
  triggerAriaLabel,
  triggerClassName = DEFAULT_TRIGGER_CLASS_NAME,
  menuWidthClassName = "w-56",
  placement = "bottom-end",
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);
  const { floatingStyles, context, isPositioned } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    strategy: "fixed",
    placement,
    middleware: [
      offset(MENU_OFFSET_PX),
      flip({ padding: MENU_VIEWPORT_PADDING_PX }),
      shift({ padding: MENU_VIEWPORT_PADDING_PX }),
    ],
    whileElementsMounted: autoUpdate,
    elements: { reference: triggerElement, floating: panelElement },
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  if (items.length === 0) {
    return null;
  }

  const handleItemSelect = (item: ActionMenuItem) => {
    setIsOpen(false);
    item.onSelect();
  };

  return (
    <>
      <button
        ref={setTriggerElement}
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className={triggerClassName}
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        {...getReferenceProps()}
      >
        <LuEllipsis className="h-4 w-4" />
      </button>
      {isOpen ? (
        <FloatingPortal>
          <div
            ref={setPanelElement}
            role="menu"
            className={`liquid-user-menu z-420 rounded-2xl p-2 ${menuWidthClassName}`}
            style={{ ...floatingStyles, visibility: isPositioned ? "visible" : "hidden" }}
            {...getFloatingProps()}
          >
            {items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => handleItemSelect(item)}
                disabled={item.disabled}
                className={[
                  index === 0 ? "" : item.variant === "danger" ? "mt-2" : "mt-1",
                  MENU_ITEM_CLASS_NAME,
                  VARIANT_CLASS_NAME[item.variant ?? "default"],
                ].join(" ")}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
