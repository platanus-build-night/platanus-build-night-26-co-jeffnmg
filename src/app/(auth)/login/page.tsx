import { Suspense } from "react";

import { LoginForm } from "@/modules/auth/components/LoginForm";

export const metadata = { title: "Iniciar sesión — JamRoom" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
