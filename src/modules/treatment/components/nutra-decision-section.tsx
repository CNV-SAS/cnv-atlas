"use client";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { Panel } from "@/components/shared/panel";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";

import { saveNutraDecisionAction } from "../actions";
import type { TreatmentProtocol } from "../data/treatment-view-types";

// LA DECISION SOBRE LOS NUTRACEUTICOS (CP-N1, 2026-08-24).
//
// Por que existe: el bloque de entrega ASUMIA que el paciente compra. No preguntaba si PUEDE tomarlos
// (eso lo decide el profesional: alergia, interaccion, contraindicacion) ni si QUIERE (eso lo decide el
// paciente). Y sin la pregunta, no habia dato para la direccion ni razon registrada de por que no.
//
// UNA SOLA PREGUNTA, con las dos del profesional SEPARADAS (clinica / no clinica): clasifica el, y el
// sistema no tiene que adivinar si "alergia al calostro" es clinico mientras "no le gusta el sabor" no lo
// es. Esa adivinanza no la puede hacer un switch, y equivocarla mandaria un dato comercial a la historia
// clinica o al reves. Y resuelve el ORDEN de las dos decisiones sin dos pantallas: el profesional que
// descarto no llega a preguntarle al paciente, marca su razon.
//
// "PENDIENTE" ES RESPUESTA DE PRIMERA CLASE y NO vence sola: el paciente puede volver, y un "no compro"
// que nadie dijo entraria en las metricas de direccion como si lo hubiera dicho. Lleva FECHA, porque un
// pendiente sin fecha se lee igual el dia uno que a los seis meses.

const EMPTY = { error: null, success: null, warning: null };

const RAZONES: { value: string; label: string; pideTexto: boolean }[] = [
  { value: "profesional_clinica", label: "Como profesional no lo recomiendo, por razones clínicas", pideTexto: true },
  { value: "profesional_no_clinica", label: "Como profesional no lo recomiendo, por razones no clínicas", pideTexto: true },
  { value: "costo", label: "El paciente no puede asumir el costo", pideTexto: false },
  { value: "lo_piensa", label: "El paciente lo va a pensar", pideTexto: false },
  { value: "ya_toma_otros", label: "El paciente ya toma otros suplementos", pideTexto: false },
  { value: "otra", label: "Otra", pideTexto: true },
];

const DECISION_LABEL: Record<string, string> = {
  si: "Sí, los adquiere",
  no: "No los adquiere",
  pendiente: "Todavía no lo decide",
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

export function NutraDecisionSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveNutraDecisionAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const guardada = protocol.nutraceuticalDecision;
  const [decision, setDecision] = useState<string>(guardada?.decision ?? "");
  const [reason, setReason] = useState<string>(guardada?.reason ?? "");
  const razonSeleccionada = RAZONES.find((r) => r.value === reason);
  const pideTexto = Boolean(razonSeleccionada?.pideTexto);
  const esClinica = reason === "profesional_clinica";

  return (
    <Panel titulo="¿El paciente adquiere los nutracéuticos?">
      <p className="max-w-prose text-sm text-muted-foreground">
        Se registra siempre, también si todavía no lo ha decidido. La entrega de abajo se habilita solo si
        la respuesta es que sí.
      </p>

      {guardada ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">{DECISION_LABEL[guardada.decision]}</span>
          <span className="text-muted-foreground"> · registrado el {fecha(guardada.at)}</span>
          {guardada.note ? (
            <span className="mt-1 block text-muted-foreground">{guardada.note}</span>
          ) : null}
        </p>
      ) : null}

      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-4">
            {(["si", "no", "pendiente"] as const).map((v) => (
              <label key={v} className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="radio"
                  name="decision"
                  value={v}
                  checked={decision === v}
                  onChange={() => {
                    setDecision(v);
                    if (v !== "no") setReason("");
                  }}
                />
                {DECISION_LABEL[v]}
              </label>
            ))}
          </div>

          {/* La razon SOLO cuando es "no": pedirla en los otros dos seria pedir explicacion por decidir
              bien o por no haber decidido todavia. */}
          {decision === "no" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="nutra-reason">Por qué no</Label>
              <select
                id="nutra-reason"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-9 max-w-lg rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecciona una razón</option>
                {RAZONES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {pideTexto ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="nutra-note">{esClinica ? "Motivo clínico" : "Motivo"}</Label>
                  <Input id="nutra-note" name="note" maxLength={1000} placeholder="Escribe el motivo" />
                  {/* Se le dice al profesional QUE pasa con lo que escribe. Un dato que viaja a la historia
                      del paciente sin avisar es peor que no pedirlo. */}
                  {esClinica ? (
                    <p className="text-xs text-muted-foreground">
                      Este motivo se guarda como <strong>contraindicación del paciente</strong>: quedará
                      visible en sus próximas consultas, también para otro profesional.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <Button type="submit" variant="outline" disabled={pending || !decision}>
              {pending ? "Guardando..." : "Registrar decisión"}
            </Button>
          </div>
        </fieldset>
      </form>
    </Panel>
  );
}
