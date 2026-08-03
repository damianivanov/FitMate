import { Fragment, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  type Placement,
} from "@floating-ui/react";
import { LuCheck, LuEllipsis } from "react-icons/lu";

const MENU_OFFSET_PX = 8;
const MENU_VIEWPORT_PADDING_PX = 8;
const MOBILE_BOTTOM_NAV_SELECTOR = ".liquid-mobile-bottom-nav-shell";
const MENU_ITEM_CLASS_NAME =
  "flex min-h-11 w-full cursor-pointer items-center justify-start gap-2 rounded-full bg-transparent px-3 py-2 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60";
const DEFAULT_TRIGGER_CLASS_NAME =
  "liquid-pill relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground before:absolute before:-inset-1 before:rounded-full before:content-['']";

export type ActionMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  group?: string;
  selected?: boolean;
};

const VARIANT_CLASS_NAME: Record<NonNullable<ActionMenuItem["variant"]>, string> = {
  default: "text-secondary hover:bg-[var(--menu-item-hover-bg)] focus-visible:bg-[var(--menu-item-hover-bg)]",
  primary:
    "text-[var(--menu-item-primary-fg)] hover:bg-[var(--menu-item-primary-hover-bg)] focus-visible:bg-[var(--menu-item-primary-hover-bg)]",
  danger:
    "text-[var(--menu-item-danger-fg)] hover:bg-[var(--menu-item-danger-hover-bg)] focus-visible:bg-[var(--menu-item-danger-hover-bg)]",
};

const SELECTED_CLASS_NAME =
  "bg-[var(--menu-item-primary-hover-bg)] text-[var(--menu-item-primary-fg)]";

function getGroupKey(item: ActionMenuItem): string {
  return item.group ?? (item.variant === "danger" ? "danger" : "default");
}

function getItemRole(item: ActionMenuItem, selectionMode: "single" | undefined): string {
  if (item.selected === undefined) {
    return "menuitem";
  }
  return selectionMode === "single" ? "menuitemradio" : "menuitemcheckbox";
}

function getOriginClassName(placement: Placement): string {
  const [side, alignment] = placement.split("-");
  if (side === "top") {
    if (alignment === "start") return "origin-bottom-left";
    if (alignment === "end") return "origin-bottom-right";
    return "origin-bottom";
  }
  if (side === "bottom") {
    if (alignment === "start") return "origin-top-left";
    if (alignment === "end") return "origin-top-right";
    return "origin-top";
  }
  return side === "left" ? "origin-right" : "origin-left";
}

function readBottomViewportPadding(): number {
  if (typeof document === "undefined") {
    return MENU_VIEWPORT_PADDING_PX;
  }
  const navShell = document.querySelector(MOBILE_BOTTOM_NAV_SELECTOR);
  if (!navShell) {
    return MENU_VIEWPORT_PADDING_PX;
  }
  const rect = navShell.getBoundingClientRect();
  if (rect.height === 0) {
    return MENU_VIEWPORT_PADDING_PX;
  }
  return Math.max(
    MENU_VIEWPORT_PADDING_PX,
    window.innerHeight - rect.top + MENU_VIEWPORT_PADDING_PX,
  );
}

type ActionMenuProps = {
  items: ActionMenuItem[];
  triggerAriaLabel: string;
  triggerContent?: ReactNode;
  triggerClassName?: string;
  triggerOpenClassName?: string;
  menuWidthClassName?: string;
  placement?: Placement;
  selectionMode?: "single";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ActionMenu({
  items,
  triggerAriaLabel,
  triggerContent,
  triggerClassName = DEFAULT_TRIGGER_CLASS_NAME,
  triggerOpenClassName = "",
  menuWidthClassName = "w-56",
  placement = "bottom-end",
  selectionMode,
  open,
  onOpenChange,
}: ActionMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [bottomPadding, setBottomPadding] = useState(MENU_VIEWPORT_PADDING_PX);
  const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(null);
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);
  const listRef = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const isOpen = open ?? uncontrolledOpen;

  const middleware = useMemo(
    () => [
      offset(MENU_OFFSET_PX),
      flip({
        padding: {
          top: MENU_VIEWPORT_PADDING_PX,
          right: MENU_VIEWPORT_PADDING_PX,
          bottom: bottomPadding,
          left: MENU_VIEWPORT_PADDING_PX,
        },
      }),
      shift({
        padding: {
          top: MENU_VIEWPORT_PADDING_PX,
          right: MENU_VIEWPORT_PADDING_PX,
          bottom: bottomPadding,
          left: MENU_VIEWPORT_PADDING_PX,
        },
      }),
    ],
    [bottomPadding],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setBottomPadding(readBottomViewportPadding());
    }
    if (open === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const { floatingStyles, context, isPositioned, placement: resolvedPlacement } = useFloating({
    open: isOpen,
    onOpenChange: handleOpenChange,
    strategy: "fixed",
    placement,
    middleware,
    whileElementsMounted: autoUpdate,
    elements: { reference: triggerElement, floating: panelElement },
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const listNavigation = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
    focusItemOnOpen: "auto",
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    listNavigation,
  ]);

  if (items.length === 0) {
    return null;
  }

  const handleItemSelect = (item: ActionMenuItem) => {
    handleOpenChange(false);
    item.onSelect();
  };

  return (
    <>
      <button
        ref={setTriggerElement}
        type="button"
        className={[triggerClassName, isOpen ? triggerOpenClassName : ""].join(" ")}
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        {...getReferenceProps()}
      >
        {triggerContent ?? <LuEllipsis className="h-4 w-4" aria-hidden="true" />}
      </button>
      {isOpen ? (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            {/* Outer = floating-ui positioning (transform). Inner = origin-aware entrance
                (its own transform) so the keyframe doesn't fight the positioning transform. */}
            <div
              ref={setPanelElement}
              className="z-420"
              style={{ ...floatingStyles, visibility: isPositioned ? "visible" : "hidden" }}
              {...getFloatingProps()}
            >
              <div
                id={menuId}
                role="menu"
                aria-label={triggerAriaLabel}
                className={`liquid-user-menu rounded-2xl p-2 ${menuWidthClassName} ${getOriginClassName(
                  resolvedPlacement,
                )} ${
                  resolvedPlacement.startsWith("top")
                    ? "lookup-dropdown-menu-enter-up"
                    : "lookup-dropdown-menu-enter-down"
                }`}
              >
                {items.map((item, index) => {
                  const previousItem = index === 0 ? null : items[index - 1];
                  const needsSeparator =
                    previousItem !== null && getGroupKey(previousItem) !== getGroupKey(item);
                  return (
                    <Fragment key={item.key}>
                      {needsSeparator ? (
                        <div
                          role="separator"
                          className="mx-3 my-1.5 h-px bg-[var(--menu-divider)]"
                        />
                      ) : null}
                      <button
                        ref={(node) => {
                          listRef.current[index] = node;
                        }}
                        type="button"
                        role={getItemRole(item, selectionMode)}
                        aria-checked={item.selected}
                        tabIndex={(activeIndex ?? 0) === index ? 0 : -1}
                        disabled={item.disabled}
                        className={[
                          index === 0 || needsSeparator ? "" : "mt-1",
                          MENU_ITEM_CLASS_NAME,
                          item.selected
                            ? SELECTED_CLASS_NAME
                            : VARIANT_CLASS_NAME[item.variant ?? "default"],
                        ].join(" ")}
                        {...getItemProps({ onClick: () => handleItemSelect(item) })}
                      >
                        {item.icon ? (
                          <span aria-hidden="true" className="flex shrink-0 items-center">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.selected ? (
                          <LuCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                        ) : null}
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      ) : null}
    </>
  );
}
