"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { anularLinkFormAction, entregarVentaFormAction } from "../actions";
import type { AccionDeVentaState } from "../validations";

const initial: AccionDeVentaState = { error: null, success: null, warning: null };

// LOS BOTONES QUE ACTUAN SOBRE UNA VENTA, en dos pasos porque ninguno se deshace:
//
//   · ANULAR LINK (decision (a) de Santiago, 2026-09-14): el link deja de servir y sus unidades quedan libres.
//     Si el paciente ya tenia abierta la pagina de Wompi y paga igual, Atlas no lo factura solo.
//   · ENTREGAR: el paciente se llevo el producto. Queda en la auditoria clinica.
//
// EL REFRESCO LO HACE LA PANTALLA, DESPUES DEL TOAST (`useFormToastAndRefresh`): el boton desaparece al
// actuar, y si la accion revalidara, se desmontaria antes de mostrar el mensaje.

const ACCIONES = {
  anular: {
    accion: anularLinkFormAction,
    pedir: "Anular link",
    aviso: "El paciente ya no podrá pagarlo.",
    confirmar: "Sí, anular",
    enCurso: "Anulando...",
    variante: "destructive" as const,
  },
  entregar: {
    accion: entregarVentaFormAction,
    pedir: "Entregar",
    aviso: "Confirma que el paciente se lleva el producto.",
    confirmar: "Sí, lo entregué",
    enCurso: "Registrando...",
    variante: "default" as const,
  },
};

export type AccionDeVenta = keyof typeof ACCIONES;

export function AccionDeVentaButton({ transactionId, tipo }: { transactionId: string; tipo: AccionDeVenta }) {
  const a = ACCIONES[tipo];
  const [state, action, pending] = useActionState(a.accion, initial);
  useFormToastAndRefresh(state);
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button key="pedir" type="button" size="sm" variant="outline" onClick={() => setConfirmando(true)}>
        {a.pedir}
      </Button>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <span className="text-xs text-muted-foreground">{a.aviso}</span>
      {/* `key` distinta de la del primer boton: el mismo nodo pasando de type=button a submit dentro del
          clic se enviaria solo (hazard 1 de CLAUDE.md). */}
      <Button key="confirmar" type="submit" size="sm" variant={a.variante} disabled={pending}>
        {pending ? a.enCurso : a.confirmar}
      </Button>
      <Button
        key="cancelar"
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirmando(false)}
      >
        Cancelar
      </Button>
    </form>
  );
}
