import { createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Hospital, UserCog, BedDouble, BellRing, FileBarChart, Settings,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const nav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/wards", label: "Ward Management", icon: Hospital },
  { to: "/admin/nurses", label: "Manage Nurses", icon: UserCog },
  { to: "/admin/patients", label: "Manage Patients", icon: BedDouble },
  { to: "/admin/alerts", label: "Alerts", icon: BellRing },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const titleFor = (path: string) => {
  if (path === "/admin") return "Hospital Command Center";
  if (path.startsWith("/admin/wards")) return "Ward Management";
  if (path.startsWith("/admin/nurses")) return "Manage Nurses";
  if (path.startsWith("/admin/patients")) return "Manage Patients";
  if (path.startsWith("/admin/alerts")) return "Alerts";
  if (path.startsWith("/admin/reports")) return "Reports";
  if (path.startsWith("/admin/settings")) return "Settings";
  return "Admin";
};

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const path = useRouterState({ select: s => s.location.pathname });
  return <AppShell role="admin" nav={nav} title={titleFor(path)} />;
}