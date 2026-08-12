/**
 * Fired on the frame the visual change commits — a snap, a selection — so the two senses
 * land together. Reserved for those moments; constant feedback trains people to ignore it.
 */
export function tick(milliseconds = 8): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  navigator.vibrate(milliseconds);
}
