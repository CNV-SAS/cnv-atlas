"use client";

import { startTransition, useActionState, useState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { saveProximoControlAction, type ProximoControlState } from "../actions";
import type { ProximoControlView } from "../data/proximo-control";

const initial: ProximoControlState = { error: null, success: null, warning: null };

// PROXIMO CONTROL. Porte de su bloque, con dos divergencias deliberadas:
//
// 1. La fecha SUGERIDA se muestra, no se guarda. En su prototipo un efecto la persiste en cuanto la
//    pantalla la propone, asi que una cita que nadie confirmo figura como la cita del paciente. Y eso deja
//    sin efecto su propia regla: un "empeoro" solo se comunica CON cita agendada, y si el sistema la agenda
//    solo, la condicion siempre esta cumplida.
// 2. R6 no tiene egreso, tiene PERMANENCIA. La pantalla lo llama por lo que es.
export function ProximoControl({
  evaluationId,
  vista,
}: {
  evaluationId: string;
  vista: ProximoControlView;
}) {
  const [state, save, saving] = useActionState(saveProximoControlAction, initial);
  useFormToast(state);
  // Prefill: la guardada si existe; si no, la sugerida. El input arranca con ella VISIBLE, pero nada se
  // escribe hasta que el profesional pulsa el boton.
  const [fecha, setFecha] = useState(vista.citaGuardada ?? vista.citaSugerida ?? "");
  const sinConfirmar = vista.citaGuardada == null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Próximo control</CardTitle>
        {vista.ruta ? (
          <span className="text-xs text-muted-foreground">
            Ruta primaria activa: {vista.ruta.id} · {vista.ruta.label}. Frecuencia recomendada:{" "}
            {vista.ruta.frecuencia}.
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Esta evaluación no tiene rutas de atención activas, así que el modelo no sugiere una frecuencia.
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {vista.ruta ? (
          <p className="rounded-md border border-clinical-optimal/30 bg-clinical-optimal-bg px-3 py-2 text-xs text-foreground">
            {vista.ruta.esPermanencia ? (
              <>
                <strong>Objetivo de la ruta:</strong> {vista.ruta.criterioEgreso}
              </>
            ) : (
              <>
                <strong>Criterio de egreso (DFI):</strong> {vista.ruta.criterioEgreso}
              </>
            )}
          </p>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => save(data));
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="evaluationId" value={evaluationId} />
          <input type="hidden" name="sugerida" value={vista.citaSugerida ?? ""} />
          <div className="flex flex-col gap-1">
            <label htmlFor={`cita-${evaluationId}`} className="text-xs text-muted-foreground">
              Fecha del próximo control
              {vista.citaSugerida ? " (el modelo sugiere una según la frecuencia de la ruta)" : ""}
            </label>
            <input
              id={`cita-${evaluationId}`}
              name="proximaCita"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={!vista.puedeGuardar}
              className="w-fit rounded-md border border-input bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
            />
          </div>

          {/* La distincion que importa: SUGERIDA no es AGENDADA. Mientras nadie confirme, el paciente no
              tiene cita, y el bloque de comunicar un cambio desfavorable la va a seguir pidiendo. */}
          {sinConfirmar && vista.citaSugerida ? (
            <p className="text-xs text-muted-foreground">
              Esta fecha todavía es una sugerencia: <strong>el paciente aún no tiene cita agendada</strong>{" "}
              hasta que la confirmes.
            </p>
          ) : null}
          {!sinConfirmar ? (
            <p className="text-xs text-muted-foreground">
              Es la cita del tratamiento de esta consulta. Si la cambias aquí, cambia también en el reporte
              del paciente.
            </p>
          ) : null}

          {vista.puedeGuardar ? (
            <Button type="submit" size="sm" disabled={saving} className="self-start">
              {saving ? "Agendando…" : sinConfirmar ? "Agendar el próximo control" : "Cambiar la fecha"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              La cita se agenda cuando la evaluación tenga su diagnóstico generado.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
