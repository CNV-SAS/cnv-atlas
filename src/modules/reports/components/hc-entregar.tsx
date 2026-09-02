"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { entregarHistoriaClinicaAction, type ReportActionState } from "../actions";

const EMPTY: ReportActionState = { error: null, success: null, warning: null };

// ENVIARLE LA HISTORIA CLINICA AL PACIENTE.
//
// SU DERECHO Y QUIEN LO CUMPLE: el paciente tiene derecho a su historia clinica completa (Resolucion 1995,
// Ley 1581), y quien se la entrega es SU PROFESIONAL, no CNV (Anexo 3, clausula 13). Este boton es la
// herramienta con la que la entrega; no hay envio automatico, y no lo debe haber.
//
// SE DICE CUANDO SE ENTREGO Y A DONDE, y esa es la razon de ser de la tabla `hc_deliveries`: el
// profesional necesita poder MOSTRAR que la entrego. Un registro que se escribe y no se ve nunca es medio
// registro (la leccion del descarte del aviso de alergeno).
export function HcEntregar({
  evaluationId,
  ultimaEntrega,
}: {
  evaluationId: string;
  /** La ultima entrega registrada, o null si nunca se le ha entregado. */
  ultimaEntrega: { fecha: string; enviadaA: string } | null;
}) {
  const [state, formAction, pending] = useActionState(entregarHistoriaClinicaAction, EMPTY);
  useFormToastAndRefresh(state);

  return (
    <div className="no-print flex flex-col gap-2">
      <form onSubmit={enviarSinReset(formAction)}>
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <Mail className="size-4" aria-hidden />
          {pending ? "Enviando..." : "Enviársela al paciente"}
        </Button>
      </form>
      {ultimaEntrega ? (
        <p className="text-xs text-muted-foreground">
          Última entrega: {ultimaEntrega.fecha} a {ultimaEntrega.enviadaA}.
        </p>
      ) : (
        // NO SE DICE "nunca se ha entregado" como si fuera una falta: la historia se entrega CUANDO EL
        // PACIENTE LA PIDE, no por defecto (su §7.1). Un aviso de pendiente sobre algo que nadie ha pedido
        // convertiria un derecho en una tarea.
        <p className="text-xs text-muted-foreground">
          Se envía cuando el paciente la pide. La entrega queda registrada.
        </p>
      )}
    </div>
  );
}
