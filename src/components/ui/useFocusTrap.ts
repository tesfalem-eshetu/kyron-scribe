"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Traps Tab focus inside the container, focuses the first control on mount,
// and calls onEscape on Escape. Restores focus to the trigger on unmount.
export function useFocusTrap<T extends HTMLElement>(onEscape?: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables[0] ?? node).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape?.();
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
  }, [onEscape]);

  return ref;
}
