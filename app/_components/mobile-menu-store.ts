"use client";

import { useSyncExternalStore } from "react";

/**
 * Open/closed state of the mobile navigation drawer, shared by the sidebar (which renders the drawer),
 * the navbar menu button and the bottom bar's "เมนู" button without lifting state into the server layout.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setMobileMenuOpen(next: boolean) {
  if (open === next) return;
  open = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMobileMenuOpen() {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
