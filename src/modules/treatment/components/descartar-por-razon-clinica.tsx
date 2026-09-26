"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveNutraDecisionAction, type TreatmentActionState } from "../actions";

const INICIAL: TreatmentActionState = { error: null, success: null, warning: null };

// ═══ DESCARTAR UN PRODUCTO POR RAZON CLINICA, EN SU PROPIA LINEA (2026-09-26) ═══
//
// ESTO ES LO UNICO DE LA PREGUNTA RETIRADA QUE NO SE PODIA PERDER. De las seis razones que tenia, cinco eran
// comerciales; esta es CLINICA y se guarda como CONTRAINDICACION DEL PACIENTE, visible en sus proximas consultas
// y para otro profesional. Quitarla habria perdido informacion clinica.
//
// ── Y AL MOVERLA, MEJORA ──
//
// En la pregunta vieja el motivo clinico se guardaba SIN PRODUCTO (el formulario nunca mandaba
// `contraindicationFor`, aunque el schema lo admitia), asi que la contraindicacion quedaba "General" y el
// siguiente profesional leia "no se lo recomiendo" sin saber de que producto. Aqui el boton VIVE EN LA LINEA del
// producto, asi que el producto se sabe sin preguntarlo: es el mismo criterio de "la procedencia sale del camino
// y no de una casilla".
export function DescartarPorRazonClinica({
  evaluationId,
  nutraceuticalId,
  nombre,
}: {
  evaluationId: string;
  nutraceuticalId: string;
  nombre: string;
}) {
  const [state, action, pending] = useActionState(saveNutraDecisionAction, INICIAL);
  const [abierto, setAbierto] = useState(false);
  useFormToastRefreshOnSuccess(state);

  if (!abierto) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setAbierto(true)}
        className="text-xs text-muted-foreground"
      >
        No lo recomiendo por razón clínica
      </Button>
    );
  }

  return (
    <form
      onSubmit={enviarSinReset(action)}
      className="flex w-full flex-col gap-2 rounded-md border border-clinical-critical/40 bg-clinical-critical-bg/40 p-3"
    >
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <input type="hidden" name="decision" value="no" />
      <input type="hidden" name="reason" value="profesional_clinica" />
      {/* EL PRODUCTO VIAJA, que es lo que esta version arregla: sin el, la contraindicacion quedaba "General". */}
      <input type="hidden" name="contraindicationFor" value={nutraceuticalId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`clinico-${nutraceuticalId}`} className="text-xs">
          Motivo clínico para no recomendar {nombre}
        </Label>
        <Input id={`clinico-${nutraceuticalId}`} name="note" maxLength={1000} placeholder="Escribe el motivo" autoFocus />
        {/* Se le dice QUE pasa con lo que escribe. Un dato que viaja a la historia del paciente sin avisar es
            peor que no pedirlo (la frase viene de la pantalla que esto reemplaza; no se pierde). */}
        <p className="text-xs text-muted-foreground">
          Se guarda como <strong>contraindicación del paciente</strong>: quedará visible en sus próximas
          consultas, también para otro profesional.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Registrar la contraindicación"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
