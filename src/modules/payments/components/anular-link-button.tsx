"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { anularLinkFormAction } from "../actions";
import type { AccionDeVentaState } from "../validations";

const initial: AccionDeVentaState = { error: null, success: null, warning: null };

// ANULAR UN LINK DE PAGO (decision (a) de Santiago, 2026-09-14). En dos pasos, porque no se deshace: el link
// deja de servir y sus unidades quedan libres para otra venta. Si el paciente ya tenia abierta la pagina de
// Wompi y paga igual, Atlas no lo factura solo: la venta queda en revision.
//
// EL REFRESCO LO HACE LA PANTALLA, DESPUES DEL TOAST (`useFormToastAndRefresh`): el boton desaparece al
// quedar anulado, y si la accion revalidara, se desmontaria antes de mostrar el mensaje.
export function AnularLinkButton({ transactionId }: { transactionId: string }) {
  const [state, action, pending] = useActionState(anularLinkFormAction, initial);
  useFormToastAndRefresh(state);
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button key="pedir" type="button" size="sm" variant="outline" onClick={() => setConfirmando(true)}>
        Anular link
      </Button>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <span className="text-xs text-muted-foreground">El paciente ya no podrá pagarlo.</span>
      {/* `key` distinta de "Anular link": el mismo nodo pasando de type=button a submit dentro del clic se
          enviaria solo (hazard 1 de CLAUDE.md). */}
      <Button key="confirmar" type="submit" size="sm" variant="destructive" disabled={pending}>
        {pending ? "Anulando..." : "Sí, anular"}
      </Button>
      <Button key="cancelar" type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmando(false)}>
        Cancelar
      </Button>
    </form>
  );
}
