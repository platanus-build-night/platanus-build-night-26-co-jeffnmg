"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinBandForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/bands/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code }),
    });

    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo unir a la banda");
      return;
    }

    toast.success(
      data.alreadyMember
        ? `Ya eres parte de ${data.band.name}`
        : `Te uniste a ${data.band.name}`
    );
    setCode("");
    router.push(`/bands/${data.band.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Código (ej. A1B2C3)"
        maxLength={6}
        className="font-mono uppercase"
        required
      />
      <Button type="submit" variant="secondary" disabled={loading}>
        {loading ? "Uniendo…" : "Unirme"}
      </Button>
    </form>
  );
}
