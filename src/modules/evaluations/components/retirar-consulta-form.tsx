"use client";

import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deshacerRetiroFormAction, retirarEvaluacionFormAction, type RetiroState } from "../actions";

const INICIAL: RetiroState = { error: null, success: null, warning: null };

// ═══ RETIRAR UNA CONSULTA QUE NO OCURRIO, Y DESHACERLO (0212, Santiago 2026-10-07) ═══
//
// EL CASO: la paciente agendó el 21, no pudo venir, y se atendió el 25. La del 21 queda en su historia
// clínica como una consulta que nunca pasó, con su encuesta y su consentimiento firmados ese día.
//
// ── LO QUE ESTA PANTALLA TIENE QUE DECIR, Y NO ES OBVIO ────────────────────────────────────────────
//
//   1. QUE NO BORRA NADA. Si el profesional cree que borra, no lo va a usar (o lo va a usar y después se va
//      a asustar). El consentimiento firmado y la encuesta respondida son actos reales de una persona.
//   2. QUE SE PUEDE DESHACER. Es la diferencia con cerrar un cascarón, que es irreversible a propósito.
//      Retirar es un JUICIO sobre si la consulta ocurrió, y un juicio se revisa.
//   3. Y PIDE EL MOTIVO ANTES, diciendo para qué: queda en la historia clínica, y dentro de seis meses
//      alguien va a preguntar por qué falta una consulta.
//
// SIN `<form>` PROPIO (hazard 7 de CLAUDE.md): esto se monta dentro de una tabla que ya vive en pantallas con
// formularios, y un `<form>` dentro de otro lo descarta el navegador. Campos sin `name`, controlados.
export function RetirarConsultaForm({
  evaluationId,
  retirada,
  motivo,
}: {
  evaluationId: string;
  retirada: boolean;
  /** El motivo con el que se retiró, para poder leerlo sin abrir el audit. */
  motivo?: string | null;
}) {
  const [state, action, pending] = useActionState(retirarEvaluacionFormAction, INICIAL);
  const [stateDeshacer, accionDeshacer, pendingDeshacer] = useActionState(deshacerRetiroFormAction, INICIAL);
  useFormToastAndRefresh(state);
  useFormToastAndRefresh(stateDeshacer);
  const [abierto, setAbierto] = useState(false);
  const [razon, setRazon] = useState("");

  // YA RETIRADA: se dice con qué motivo y se ofrece deshacerlo. Sin el motivo a la vista habría que ir al
  // audit para saber por qué falta una consulta, y nadie va a ir.
  if (retirada) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">
          Retirada{motivo ? `: ${motivo}` : ""}
        </span>
        <Button
          key="deshacer-retiro"
          type="button"
          variant="ghost"
          size="sm"
          disabled={pendingDeshacer}
          onClick={() => {
            const fd = new FormData();
            fd.set("evaluationId", evaluationId);
            ejecutarAccion(accionDeshacer, fd);
          }}
        >
          {pendingDeshacer ? "Deshaciendo..." : "Deshacer"}
        </Button>
      </div>
    );
  }

  if (!abierto) {
    return (
      <Button
        key="abrir-retiro"
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setAbierto(true)}
      >
        Esta consulta no ocurrió
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-left">
      <p className="max-w-prose text-xs text-muted-foreground">
        La consulta deja de contar en la historia del paciente.{" "}
        <strong className="text-foreground">No se borra nada:</strong> su encuesta y su consentimiento se
        conservan, y esto se puede deshacer.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={`motivo-retiro-${evaluationId}`} className="text-xs font-medium">
          Por qué no ocurrió
        </label>
        {/* SIN `name`, a propósito: este bloque vive dentro de una pantalla con formularios y un campo con
            nombre viajaría en ESE envío. */}
        <Input
          id={`motivo-retiro-${evaluationId}`}
          maxLength={300}
          value={razon}
          onChange={(e) => setRazon(e.target.value)}
          placeholder="Por ejemplo: agendó y no vino; se atendió el 25"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          key="confirmar-retiro"
          type="button"
          size="sm"
          disabled={pending || razon.trim().length < 5}
          onClick={() => {
            const fd = new FormData();
            fd.set("evaluationId", evaluationId);
            fd.set("motivo", razon);
            ejecutarAccion(action, fd);
          }}
        >
          {pending ? "Retirando..." : "Retirar la consulta"}
        </Button>
        <Button
          key="cancelar-retiro"
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
