"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { SidebarProvider } from "./sidebar-context";
import { cn } from "@/lib/utils";

const COOKIE = "ts-sidebar";

/**
 * Client shell wrapper that owns the sidebar state and keeps the main content
 * offset in sync. On desktop the rail can collapse to icon-only width; its
 * initial state comes from a cookie (read server-side in the layout) so there is
 * no hydration flash, and toggling persists back to it. Below the `lg`
 * breakpoint the rail becomes an off-canvas drawer toggled from the topbar.
 */
export function ShellLayout({
  collapsed: initialCollapsed,
  topbar,
  children,
}: Readonly<{ collapsed: boolean; topbar: ReactNode; children: ReactNode }>) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const value = useMemo(
    () => ({
      collapsed,
      mobileOpen,
      setMobileOpen,
      toggleCollapsed() {
        setCollapsed((prev) => {
          const next = !prev;
          document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
          return next;
        });
      },
    }),
    [collapsed, mobileOpen],
  );

  return (
    <SidebarProvider value={value}>
      <div className="min-h-screen w-full">
        <Sidebar />
        <div
          className={cn(
            "flex min-h-screen flex-col transition-[padding] duration-200",
            collapsed ? "lg:pl-16" : "lg:pl-60",
          )}
        >
          {topbar}
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
