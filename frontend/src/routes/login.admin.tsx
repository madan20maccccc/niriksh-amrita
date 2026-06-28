import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/LoginForm";

export const Route = createFileRoute("/login/admin")({
  head: () => ({ meta: [{ title: "Admin login — NirikshAmrita" }] }),
  component: () => <LoginForm role="admin" />,
});