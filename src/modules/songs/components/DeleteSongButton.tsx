"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DeleteSongButton({
  songId,
  bandId,
}: {
  songId: string;
  bandId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm("¿Eliminar esta canción? No se puede deshacer.")) return;
    setLoading(true);

    const res = await fetch(`/api/songs/${songId}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "No se pudo eliminar");
      setLoading(false);
      return;
    }

    toast.success("Canción eliminada");
    router.push(`/bands/${bandId}`);
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 />
      Eliminar
    </Button>
  );
}
