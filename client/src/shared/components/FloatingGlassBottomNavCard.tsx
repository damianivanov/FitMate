import { useMemo, type CSSProperties, type MouseEvent } from "react";
import { LuHeart, LuHouse, LuSend, LuSparkles } from "react-icons/lu";

type FloatingNavItemId = "home" | "navigate" | "favorites" | "discover";

type FloatingGlassBottomNavCardProps = {
  onSelect?: (itemId: FloatingNavItemId) => void;
};

type FloatingNavItem = {
  id: FloatingNavItemId;
  label: string;
  Icon: typeof LuHouse;
  isHighlighted: boolean;
};

const CARD_BACKGROUND_STYLE: CSSProperties = {
  backgroundImage: [
    "linear-gradient(170deg, rgba(255, 211, 150, 0.26) 0%, rgba(168, 103, 58, 0.34) 42%, rgba(40, 22, 15, 0.74) 100%)",
    "radial-gradient(circle at 20% 20%, rgba(255, 204, 125, 0.34) 0%, rgba(255, 204, 125, 0) 50%)",
    "radial-gradient(circle at 78% 38%, rgba(224, 145, 85, 0.34) 0%, rgba(224, 145, 85, 0) 52%)",
    "radial-gradient(circle at 50% 88%, rgba(12, 7, 4, 0.6) 0%, rgba(12, 7, 4, 0) 55%)",
  ].join(", "),
  boxShadow: "0 18px 34px rgba(24, 13, 8, 0.3)",
};

const NAV_BAR_STYLE: CSSProperties = {
  background: "linear-gradient(120deg, rgba(146, 95, 51, 0.42), rgba(94, 59, 35, 0.35), rgba(74, 46, 29, 0.4))",
  border: "1px solid rgba(255, 236, 208, 0.1)",
  boxShadow: [
    "0 12px 24px rgba(30, 18, 8, 0.26)",
    "inset 0 1px 0 rgba(255, 240, 218, 0.18)",
    "inset 0 -1px 0 rgba(62, 38, 20, 0.28)",
    "inset 0 0 24px rgba(255, 196, 122, 0.08)",
  ].join(", "),
};

function getIconButtonClassName(isHighlighted: boolean): string {
  if (isHighlighted) {
    return "flex h-9 w-9 items-center justify-center rounded-full bg-amber-50/12 ring-1 ring-amber-50/22";
  }

  return "flex h-9 w-9 items-center justify-center";
}

export function FloatingGlassBottomNavCard({ onSelect }: FloatingGlassBottomNavCardProps) {
  const navItems = useMemo<ReadonlyArray<FloatingNavItem>>(
    () => [
      { id: "home", label: "Home", Icon: LuHouse, isHighlighted: true },
      { id: "navigate", label: "Navigate", Icon: LuSend, isHighlighted: false },
      { id: "favorites", label: "Favorites", Icon: LuHeart, isHighlighted: false },
      { id: "discover", label: "Discover", Icon: LuSparkles, isHighlighted: false },
    ],
    [],
  );

  const handleNavItemClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!onSelect) {
      return;
    }

    const itemId = event.currentTarget.dataset.itemId as FloatingNavItemId | undefined;
    if (!itemId) {
      return;
    }

    onSelect(itemId);
  };

  return (
    <article className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl" style={CARD_BACKGROUND_STYLE}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/34 via-black/8 to-transparent" />

      <div className="absolute bottom-4 left-1/2 h-12 w-3/4 -translate-x-1/2 rounded-full px-3 backdrop-blur-xl" style={NAV_BAR_STYLE}>
        <nav aria-label="Floating mobile navigation" className="h-full">
          <ul className="grid h-full grid-cols-4 place-items-center">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-item-id={item.id}
                  onClick={handleNavItemClick}
                  aria-label={item.label}
                  className={getIconButtonClassName(item.isHighlighted)}
                >
                  <item.Icon className="h-5 w-5 text-amber-50/85" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </article>
  );
}
