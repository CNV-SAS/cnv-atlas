"use client";

import { useActionState, useState } from "react";

import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { confirmRemesaFormAction } from "../actions";
// Tipo desde el módulo neutro, NO desde el service `server-only` (este es un componente cliente).
import type { PendingRemesa } from "../remesa-types";
import type { NutraceuticalFormState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

// ═══ CONFIRMAR ES UN CLIC; TECLEAR ES LA EXCEPCION (Santiago, 2026-09-25) ═══
//
// Antes esto pedia SIEMPRE "cuántas llegaron", con lo declarado como valor por defecto. En la practica eso es
// pedirle al integrante que transcriba un numero que CNV ya escribio, y lo normal es que coincida: el
// formulario le daba trabajo de digitacion en el caso comun y trataba igual los dos casos.
//
// Ahora el camino normal es UN BOTON ("Llegó completo"), y objetar es lo que abre el campo. Sigue siendo un
// acto de reconocer custodia y no un "aceptar": lo que cambia es que solo escribe quien tiene algo distinto
// que decir. El mecanismo de abajo no se toco: la cantidad real sigue viajando y sigue abriendo el caso.
function ConfirmRemesaForm({ remesa }: { remesa: PendingRemesa }) {
  const [state, action, pending] = useActionState(confirmRemesaFormAction, initial);
  useFormToastAndRefresh(state);
  const [objetando, setObjetando] = useState(false);

  if (!objetando) {
    return (
      <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <input type="hidden" name="remesaId" value={remesa.remesaId} />
        {/* Lo declarado viaja tal cual: confirmar es decir "llegó lo que dice". */}
        <input type="hidden" name="actualQuantity" value={remesa.declaredQuantity} />
        <input type="hidden" name="lote" value={remesa.lote ?? ""} />
        <Button type="submit" disabled={pending}>
          {pending ? "Confirmando..." : `Llegó completo (${remesa.declaredQuantity})`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setObjetando(true)} disabled={pending}>
          No llegó así
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
      <input type="hidden" name="remesaId" value={remesa.remesaId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`qty-${remesa.remesaId}`}>Cuántas llegaron de verdad</Label>
        <Input
          id={`qty-${remesa.remesaId}`}
          name="actualQuantity"
          inputMode="numeric"
          defaultValue={remesa.declaredQuantity}
          required
          className="w-32"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`lote-${remesa.remesaId}`}>Lote</Label>
        <Input id={`lote-${remesa.remesaId}`} name="lote" defaultValue={remesa.lote ?? ""} placeholder="Lote" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Registrando..." : "Registrar lo que llegó"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setObjetando(false)} disabled={pending}>
        Cancelar
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Si llegó menos, la diferencia queda registrada y CNV la ve. Si no llegó nada, escribe 0.
      </p>
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
        <Badge className="bg-attention-bg text-attention">{pending.length}</Badge>
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
