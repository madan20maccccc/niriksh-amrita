import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/LoginForm";

export const Route = createFileRoute("/login/nurse")({
  head: () => ({ meta: [{ title: "Nurse login — NirikshAmrita" }] }),
  component: () => <LoginForm role="nurse" />,
});