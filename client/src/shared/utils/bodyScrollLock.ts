/**
 * Ref-counted body scroll lock shared by every overlay (Modal, WorkoutSheet, ...).
 *
 * A single shared counter is important: when the workout sheet (locked) opens a
 * modal from inside itself (also locked), two independent counters could unlock
 * the body prematurely. One counter keeps the lock until the LAST overlay closes.
 */

let bodyScrollLockCount = 0;
let previousBodyOverflowValue = "";

export function lockBodyScroll(): void {
  if (typeof document === "undefined") {
    return;
  }

  if (bodyScrollLockCount === 0) {
    previousBodyOverflowValue = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  bodyScrollLockCount += 1;
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined" || bodyScrollLockCount === 0) {
    return;
  }

  bodyScrollLockCount -= 1;

  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflowValue;
    previousBodyOverflowValue = "";
  }
}
