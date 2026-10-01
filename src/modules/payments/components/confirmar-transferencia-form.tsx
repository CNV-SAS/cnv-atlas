"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { confirmarTransferenciaAction, type DevolucionState } from "../actions";

// ═══ "VERIFIQUÉ EL EXTRACTO, EL PAGO ENTRÓ" (Santiago, 2026-10-01) ═══
//
// EL CRITERIO ES SUYO: "la única forma de verificar una transferencia es que alguien se meta a ver la cuenta
// bancaria y compruebe el pago". De ahí sale la regla: LA AUTOMATIZACIÓN NO AFIRMA EL PAGO, LO AFIRMA QUIEN
// LO VIO.
//
// POR QUÉ ES UN BOTÓN Y NO UNA CASILLA: lo que ocurre al pulsarlo no es marcar un estado, es REGISTRAR UN
// PAGO en un documento fiscal, con el nombre de quien lo comprobó. Una casilla invita a marcarla de paso.
//
// Y EL TEXTO DICE LO QUE VA A PASAR, no "confirmar": nadie debería tener que pulsar para averiguar qué hace
// un botón que mueve plata.
const inicial: DevolucionState = { error: null, success: null, warning: null };

export function ConfirmarTransferenciaForm({ transactionId }: { transactionId: string }) {
  const [state, action, pending] = useActionState(confirmarTransferenciaAction, inicial);
  useFormToastAndRefresh(state);

  return (
    <form onSubmit={enviarSinReset(action)} className="mt-2 flex flex-col gap-1">
      <input type="hidden" name="transactionId" value={transactionId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Registrando el pago..." : "Verifiqué el extracto: el pago entró"}
      </Button>
      <span className="text-xs text-muted-foreground">
        Registra el pago en Alegra con tu nombre y la fecha. Atlas no lo hace solo en una transferencia:
        quien lo afirma es quien lo vio en la cuenta.
      </span>
    </form>
  );
}
