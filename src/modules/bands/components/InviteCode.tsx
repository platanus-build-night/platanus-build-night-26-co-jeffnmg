"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function InviteCode({ code }: { code: string }) {
  async function copy() {
    await navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md border bg-secondary px-3 py-1 font-mono text-sm tracking-widest">
        {code}
      </span>
      <Button variant="ghost" size="icon" onClick={copy} title="Copiar código">
        <Copy />
      </Button>
    </div>
  );
}
