"use client";

import { createContext, useContext } from "react";

export type SidebarContextValue = {
  /** Desktop rail collapsed to icon-only width. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile off-canvas drawer visibility (below the `lg` breakpoint). */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const SidebarProvider = SidebarContext.Provider;

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within <ShellLayout>");
  }
  return ctx;
}
