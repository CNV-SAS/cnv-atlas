"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { marcarEntregadoEnConsultaAction } from "@/modules/treatment/actions";
import type { TreatmentActionState } from "@/modules/treatment/actions";

const VACIO: TreatmentActionState = { error: null, success: null, warning: null };

// "ENTREGADO EN CONSULTA" · el acto que sella la prescripcion cuando el plan se entrega EN MANO.
//
// EL HUECO QUE CIERRA, verificado en el codigo antes de construirlo: el plan imprimible se arma del
// protocolo COMPUTADO, no del aprobado (`getPlanPaciente` pide `protocolSuggested`). Asi que se podia
// imprimir y entregar un plan sin que nadie lo hubiera sellado, y si el profesional nunca enviaba el
// reporte, el paciente se iba con un papel que nadie asumio.
//
// POR QUE NO LO HACE LA IMPRESION. Imprimir es LEER: se imprime para revisar antes de decidir, y se
// imprime dos veces si salio torcida. Convertir una lectura en una firma es lo contrario de lo que un acto
// clinico debe ser. Entregar SI es un acto, y por eso se declara aparte.
//
// SELLA LO MISMO QUE EL ENVIO, con la via registrada (`entrega_en_consulta` frente a `envio`): entregar en
// mano y enviar por correo no son lo mismo si alguien pregunta despues.
export function EntregadoEnConsulta({ evaluationId }: { evaluationId: string }) {
  const [state, accion, pendiente] = useActionState(marcarEntregadoEnConsultaAction, VACIO);
  useFormToastAndRefresh(state);

  return (
    <form onSubmit={enviarSinReset(accion)} className="flex flex-col items-end gap-1">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <Button type="submit" variant="outline" size="sm" disabled={pendiente}>
        {pendiente ? "Registrando..." : "Entregado en consulta"}
      </Button>
      {/* QUE PASA AL PULSARLO, junto al boton: sella, y lo sellado deja de editarse. Un boton que cierra
          algo tiene que decir que cierra ANTES de pulsarlo, no despues. */}
      <p className="max-w-[16rem] text-right text-xs text-muted-foreground">
        Sella la prescripción tal como está. Después solo se cambia reabriéndola con un motivo.
      </p>
    </form>
  );
}
