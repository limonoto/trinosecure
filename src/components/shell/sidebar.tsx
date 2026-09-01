"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

function isItemActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** App logo + name; stacked and centered, condensed when the rail is collapsed. */
function Brand({ collapsed }: Readonly<{ collapsed: boolean }>) {
  const tApp = useTranslations("app");
  return (
    <Link
      href="/"
      title={collapsed ? tApp("name") : undefined}
      className={cn(
        "flex flex-col items-center border-b border-border py-4",
        collapsed ? "gap-0 px-0" : "gap-2 px-4",
      )}
    >
      <Image
        src="/logo.png"
        alt={tApp("name")}
        width={72}
        height={72}
        className={cn("flex-none", collapsed ? "size-9" : "size-16")}
        priority
      />
      {!collapsed && (
        <span className="text-center leading-tight">
          <span className="block text-base font-semibold tracking-tight">{tApp("name")}</span>
          <span className="block text-[10.5px] text-muted-foreground">{tApp("tagline")}</span>
        </span>
      )}
    </Link>
  );
}

/** Grouped navigation links. Shared by the desktop rail and the mobile drawer. */
function NavSections({ collapsed }: Readonly<{ collapsed: boolean }>) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  return (
    <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "space-y-1 px-2" : "space-y-4 px-3")}>
      {NAV.map((section, index) => (
        <div key={section.groupKey}>
          {!collapsed && <div className="eyebrow px-2.5 pb-1.5 text-[10px]">{tNav(section.groupKey)}</div>}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href, pathname);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={collapsed ? tNav(item.labelKey) : undefined}
                  className={cn(
                    "group relative flex items-center rounded-md text-[13px] font-medium transition-colors",
                    collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute -left-1 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
                  )}
                  <Icon className={cn("size-[17px] flex-none", active && "text-primary")} />
                  {!collapsed && <span className="leading-tight">{tNav(item.labelKey)}</span>}
                </Link>
              );
            })}
          </div>
          {collapsed && index < NAV.length - 1 && <div className="mx-2 mt-1 h-px bg-border/60" />}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const tSidebar = useTranslations("sidebar");
  const pathname = usePathname();

  // Dismiss the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <>
      {/* Desktop rail — hidden below `lg`, where the drawer takes over. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card/40 transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Brand collapsed={collapsed} />
        <NavSections collapsed={collapsed} />
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? tSidebar("expand") : tSidebar("collapse")}
            aria-label={collapsed ? tSidebar("expandAria") : tSidebar("collapseAria")}
            className={cn(
              "flex w-full items-center rounded-md py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground",
              collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[17px]" />
            ) : (
              <>
                <PanelLeftClose className="size-[17px]" />
                <span>{tSidebar("collapse")}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Mobile off-canvas drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label={tSidebar("close")}
          className="absolute right-2 top-2 z-10 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <X className="size-[17px]" />
        </button>
        <Brand collapsed={false} />
        <NavSections collapsed={false} />
      </aside>
    </>
  );
}
