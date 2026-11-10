"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { syncFromHostaway } from "@/app/dashboard/finances/actions";
import { Button } from "@/components/ui/button";

export function SyncButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await syncFromHostaway();
          if (res.ok) toast.success("Données actualisées depuis Hostaway", { description: res.data });
          else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Actualisation…" : "Actualiser depuis Hostaway"}
    </Button>
  );
}
