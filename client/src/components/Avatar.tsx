import { useState } from "react";
import type { CSSProperties } from "react";
import { getAvatarColorHex } from "@/lib/helpers";

type AvatarProps = {
  userId: number;
  initials: string;
  imageUrl?: string | null;
  size?: "sm" | "lg" | "xl";
  className?: string;
};

const sizeClassNames: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "",
  lg: "app-avatar-lg",
  xl: "app-avatar-xl",
};

/**
 * One avatar, drawn the same wherever it appears. The swatch is shaded rather than filled
 * flat — a lit top edge and a darker foot are what stop it reading as a coloured hole in
 * the chrome — and it is a single disc, not a disc nested inside a second ring.
 *
 * A picture sits inside that same disc, so the initials stay visible underneath while it
 * loads and take over again if it fails: the shape never collapses or flashes empty.
 */
export default function Avatar({ userId, initials, imageUrl, size = "sm", className = "" }: AvatarProps) {
  const style = { "--avatar-tint": getAvatarColorHex(userId) } as CSSProperties;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState(imageUrl);

  // A new picture deserves a fresh attempt, so the recorded failure is dropped the moment the
  // source changes rather than a render later.
  if (lastUrl !== imageUrl) {
    setLastUrl(imageUrl);
    setFailedUrl(null);
  }

  const source = imageUrl && imageUrl !== failedUrl ? imageUrl : null;

  return (
    <span
      className={`app-avatar ${sizeClassNames[size]} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      {initials}
      {source ? (
        <img src={source} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(source)} />
      ) : null}
    </span>
  );
}
