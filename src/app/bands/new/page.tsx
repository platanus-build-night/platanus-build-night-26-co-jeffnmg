import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CreateBandForm } from "@/modules/bands/components/CreateBandForm";

export const metadata = { title: "Crear banda — JamRoom" };

export default async function NewBandPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <section className="mx-auto flex max-w-5xl justify-center px-6 py-12">
        <CreateBandForm />
      </section>
    </main>
  );
}
