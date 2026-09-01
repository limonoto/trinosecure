import {
  LayoutDashboard,
  ShieldCheck,
  GitCompare,
  History,
  Users,
  Network,
  KeyRound,
  Layers,
  Database,
  Activity,
  TriangleAlert,
  Server,
  Gauge,
  BellRing,
  ScrollText,
  Boxes,
  Rocket,
  Settings,
  BookOpen,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  /** Translation key under the `nav` namespace (messages/tr.json). */
  labelKey: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  /** Translation key under the `nav` namespace for the section heading. */
  groupKey: string;
  items: NavItem[];
};

/**
 * Single-sidebar navigation model for the full NİZAM scope. Labels are
 * translation keys (resolved in the sidebar via next-intl) — never hardcode
 * strings here. Sections map to the requirement areas in Projeİsterleri.txt.
 */
export const NAV: NavSection[] = [
  {
    groupKey: "overview",
    items: [{ id: "dashboard", labelKey: "dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    groupKey: "authorization",
    items: [
      { id: "rules", labelKey: "rules", href: "/rules", icon: ShieldCheck },
      { id: "import", labelKey: "import", href: "/import", icon: GitCompare },
      { id: "history", labelKey: "history", href: "/history", icon: History },
    ],
  },
  {
    groupKey: "identity",
    items: [
      { id: "groups", labelKey: "groups", href: "/groups", icon: Users },
      { id: "mapping", labelKey: "mapping", href: "/mapping", icon: Network },
      { id: "passwords", labelKey: "passwords", href: "/passwords", icon: KeyRound },
    ],
  },
  {
    groupKey: "configuration",
    items: [
      { id: "resource-groups", labelKey: "resourceGroups", href: "/resource-groups", icon: Layers },
      { id: "catalogs", labelKey: "catalogs", href: "/catalogs", icon: Database },
      { id: "properties", labelKey: "clusterConfig", href: "/properties", icon: SlidersHorizontal },
    ],
  },
  {
    groupKey: "observability",
    items: [
      { id: "metrics", labelKey: "clusterHealth", href: "/metrics", icon: Activity },
      { id: "errors", labelKey: "errors", href: "/errors", icon: TriangleAlert },
      { id: "nodes", labelKey: "nodes", href: "/nodes", icon: Server },
      { id: "performance", labelKey: "performance", href: "/performance", icon: Gauge },
      { id: "resource-performance", labelKey: "resourcePerformance", href: "/resource-performance", icon: Layers },
    ],
  },
  {
    groupKey: "governance",
    items: [
      { id: "alerts", labelKey: "alerts", href: "/alerts", icon: BellRing },
      { id: "audit", labelKey: "audit", href: "/audit", icon: ScrollText },
    ],
  },
  {
    groupKey: "settings",
    items: [
      { id: "environments", labelKey: "environments", href: "/environments", icon: Boxes },
      { id: "deploy", labelKey: "deploy", href: "/deploy", icon: Rocket },
      { id: "settings", labelKey: "appSettings", href: "/settings", icon: Settings },
    ],
  },
  {
    groupKey: "help",
    items: [{ id: "guide", labelKey: "guide", href: "/guide", icon: BookOpen }],
  },
];
