"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { confirmRemesaFormAction } from "../actions";
// Tipo desde el módulo neutro, NO desde el service `server-only` (este es un componente cliente).
import type { PendingRemesa } from "../remesa-types";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

// Confirmar UNA remesa (acto de reconocer custodia, no un botón de aceptar): el integrante escribe cuánto
// llegó REALMENTE, que puede diferir de lo declarado. El default es lo declarado, pero es editable. Si no
// llegó nada, confirma 0 (queda como faltante total). El aviso del action dice qué pasó con las cantidades.
function ConfirmRemesaForm({ remesa }: { remesa: PendingRemesa }) {
  const [state, action, pending] = useActionState(confirmRemesaFormAction, initial);
  useFormToast(state);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
      <input type="hidden" name="remesaId" value={remesa.remesaId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`qty-${remesa.remesaId}`}>Cuántas llegaron</Label>
        <Input
          id={`qty-${remesa.remesaId}`}
          name="actualQuantity"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={remesa.declaredQuantity}
          required
          className="w-32"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`lote-${remesa.remesaId}`}>Lote (opcional)</Label>
        <Input id={`lote-${remesa.remesaId}`} name="lote" defaultValue={remesa.lote ?? ""} placeholder="Lote" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Confirmando..." : "Confirmar recepción"}
      </Button>
    </form>
  );
}

// Remesas que CNV declaró y el integrante aún NO confirmó. Va ARRIBA en Mi inventario: sin avisos, es como se
// entera de que le mandaron algo. Si no hay ninguna, no se muestra nada (no ocupa espacio).
export function ConfirmarRemesaSection({ pending }: { pending: PendingRemesa[] }) {
  if (pending.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight">Remesas por confirmar</h2>
        <Badge className="bg-clinical-warning-bg text-clinical-warning">{pending.length}</Badge>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        CNV te envió estos productos en consignación. Confirma cuántos llegaron realmente (si difiere de lo que
        CNV declaró, escribe lo que llegó; si no llegó nada, confirma 0). Tu inventario sube según lo que
        recibiste; cualquier diferencia queda registrada para que CNV la revise.
      </p>
      <div className="flex flex-col gap-4">
        {pending.map((r) => (
          <div key={r.remesaId} className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-foreground">{r.nutraceuticalName}</span>
              <span className="text-sm text-muted-foreground">
                CNV declaró <span className="font-bold text-foreground">{r.declaredQuantity}</span>
                {r.lote ? ` · lote ${r.lote}` : ""} · {fmtDate(r.declaredAt)}
              </span>
            </div>
            <ConfirmRemesaForm remesa={r} />
          </div>
        ))}
      </div>
    </section>
  );
}
