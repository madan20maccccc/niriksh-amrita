import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Bell, User, ClipboardList, FileText } from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const nav: NavItem[] = [
  { to: "/nurse", label: "My Day", icon: LayoutDashboard },
  { to: "/nurse/patients", label: "My Patients", icon: Users },
  { to: "/nurse/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/nurse/sbar", label: "SBAR Handover", icon: FileText },
  { to: "/nurse/notifications", label: "Notifications", icon: Bell },
  { to: "/nurse/profile", label: "Profile", icon: User },
];

const titleFor = (p: string) => {
  if (p === "/nurse") return "Good day, Nurse";
  if (p.startsWith("/nurse/patients")) return "My Patients";
  if (p.startsWith("/nurse/patient")) return "Patient Details";
  if (p.startsWith("/nurse/vitals")) return "Enter Vitals";
  if (p.startsWith("/nurse/sbar")) return "SBAR Handover";
  if (p.startsWith("/nurse/notifications")) return "Notifications";
  if (p.startsWith("/nurse/profile")) return "Profile";
  if (p.startsWith("/nurse/tasks")) return "Today's Tasks";
  return "Nurse";
};

export const Route = createFileRoute("/nurse")({ component: NurseLayout });

function NurseLayout() {
  const path = useRouterState({ select: s => s.location.pathname });
  return <AppShell role="nurse" nav={nav} title={titleFor(path)} />;
}