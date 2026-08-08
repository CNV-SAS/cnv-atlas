"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

// Enlace de un checkout PENDIENTE en la lista de pagos, para recuperar el link ya generado sin tener
// que crear otro (el aviso de duplicado desalienta justo eso). Vivo: link copiable + cuanto le queda de
// las 24h. Vencido: se distingue, porque un link vencido compartido no sirve y el paciente no sabria por que.
// `hoursLeft` lo calcula el server (la pagina es dinamica, el tiempo de request es correcto).
export function CheckoutLink({ url, hoursLeft }: { url: string; hoursLeft: number }) {
  const [copied, setCopied] = useState(false);

  if (hoursLeft <= 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Enlace vencido (los links valen 24 horas). Si el paciente aún no pagó, genera uno nuevo.
      </span>
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const restante = hoursLeft >= 1 ? `vence en ${hoursLeft} h` : "vence en menos de 1 h";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="break-all text-xs text-primary">{url}</span>
      <Button type="button" size="sm" variant="ghost" onClick={copy}>
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
      <span className="text-xs text-muted-foreground">({restante})</span>
    </div>
  );
}
