"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Traps Tab focus inside the container, focuses the first meaningful control on
// mount, and calls onEscape on Escape. Restores focus to the trigger on unmount.
//
// The focus-on-mount runs exactly once. onEscape is read through a ref so the
// effect never re-runs when callers pass a fresh inline callback each render --
// otherwise focus would be yanked back to the first control on every keystroke.
export function useFocusTrap<T extends HTMLElement>(onEscape?: () => void) {
  const ref = useRef<T>(null);
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Prefer the first text-like control (e.g. the first form field) over a
    // leading icon button such as the close (X) control.
    const focusables = Array.from(
      node.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    const preferred =
      focusables.find((el) =>
        el.matches("input, textarea, select, a[href]"),
      ) ??
      focusables[0] ??
      node;
    preferred.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = node!.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}
