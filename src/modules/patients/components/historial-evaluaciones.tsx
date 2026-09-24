"use client";

import Link from "next/link";
import { useState } from "react";

import { PillEstado } from "@/components/shared/pill-estado";
import { tabla, td, tdApagado, tdFuerte, tdNum, th, theadTr, thNum, tr } from "@/components/shared/tabla";
import { AbandonEvaluation } from "@/modules/evaluations/components/abandon-evaluation";

import { repartirEvaluaciones } from "../clasificar-evaluaciones";
import { ChipEstadoEvaluacion } from "./chip-estado-evaluacion";
import { fechaCorta } from "../format";
import type { PatientEvaluationItem } from "../types";

// ═══ EL HISTORIAL DE EVALUACIONES, SIN LO QUE ESTORBA (observación L) ═══
//
// LAS ABIERTAS SIEMPRE A LA VISTA, y es la mitad que importa: son trabajo pendiente, y esconderlo es
// perderlo. Las terminadas y las retiradas se pliegan detrás de un interruptor, porque son historia y la
// historia no estorba si no ocupa la pantalla.
//
// NADA SE BORRA, y el interruptor lo dice: una evaluación arrastra diagnóstico sellado, tratamiento y
// auditoría, así que borrarla rompería la trazabilidad (misma razón por la que los pacientes se archivan).
//
// CLIENTE por el interruptor. La clasificación es pura y vive aparte (`clasificar-evaluaciones`), para que
// la pantalla no decida por su cuenta qué es historia y qué es trabajo.

const TIPO_LABEL: Record<string, string> = { inicial: "Inicial", seguimiento: "Seguimiento" };

function Fila({ e, puedeCerrar }: { e: PatientEvaluationItem; puedeCerrar: boolean }) {
  return (
    <tr key={e.evaluationId} className={tr}>
      {/* LA NEGRITA VA EN LA FECHA, y es la unica de la tabla: es por donde se recorre. Fecha de
          MEDICION (cronologia clinica), no la de creacion del registro. */}
      <td className={`${tdFuerte} whitespace-nowrap`}>{fechaCorta(e.measurementDate ?? e.createdAt)}</td>
      <td className={td}>
        {TIPO_LABEL[e.type] ?? e.type}
        {/* CHIP SOLO SI ES EXCEPCIONAL: una evaluacion vigente no lleva distintivo; una reemplazada si,
            porque cambia como se lee todo lo que hay en su fila. */}
        {e.superseded ? (
          <PillEstado tono="neutro" className="ml-2 font-normal">
            reemplazada
          </PillEstado>
        ) : null}
      </td>
      {/* Motivo de consulta (caracterizacion del encuentro, multi); "-" si no se dio. */}
      <td className={tdApagado}>{e.reasonForVisit.length ? e.reasonForVisit.join(", ") : "-"}</td>
      <td className={td}>
        <ChipEstadoEvaluacion status={e.status} />
      </td>
      <td className={tdNum}>
        {/* Segun estado: firmada sin responder -> cerrar (si es su profesional); cerrada -> rotulo sin
            accion; el resto -> ver resultados. Un shell no tiene resultados que ver. */}
        {e.status === "awaiting_survey" ? (
          puedeCerrar ? (
            // DOS SALIDAS, NO UNA (2026-09-24). Hasta hoy la unica era CERRAR, o sea archivar un
            // consentimiento ya firmado y empezar de cero. Si el paciente esta en consulta, lo que hace
            // falta es RESPONDERLA con el, y eso continua el mismo borrador que el hubiera dejado en casa.
            <div className="flex items-center justify-end gap-3">
              <Link
                href={`/ani-bis-e/${e.evaluationId}/responder-encuesta`}
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                Responder con el paciente
              </Link>
              <AbandonEvaluation evaluationId={e.evaluationId} />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Esperando la encuesta</span>
          )
        ) : e.status === "abandoned" ? (
          <span className="text-xs text-muted-foreground">Cerrada</span>
        ) : (
          <Link
            href={`/ani-bis-e/${e.evaluationId}`}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Ver resultados
          </Link>
        )}
      </td>
    </tr>
  );
}

export function HistorialEvaluaciones({
  evaluaciones,
  puedeCerrar,
}: {
  evaluaciones: PatientEvaluationItem[];
  puedeCerrar: boolean;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const { visibles: aLaVista, plegadas } = repartirEvaluaciones(evaluaciones);

  if (evaluaciones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Este paciente todavía no tiene evaluaciones.
      </div>
    );
  }

  // A LA VISTA: lo abierto y la ultima completada (es el punto de partida de la siguiente consulta).
  const visibles = verTodas ? evaluaciones : aLaVista;

  return (
    <div className="flex flex-col gap-3">
      {visibles.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          {/* DECORACION COMPARTIDA (2026-09-03): las clases salen de `components/shared/tabla`. */}
          <table className={`${tabla} min-w-[560px] text-left`}>
            <thead>
              <tr className={theadTr}>
                {/* LA FECHA VA PRIMERO, y no es cosmetico: esta tabla existe para leer la TRAYECTORIA del
                    paciente, y una trayectoria se recorre por fecha. El tipo califica cada hito. */}
                <th className={th}>Fecha</th>
                <th className={th}>Tipo</th>
                <th className={th}>Motivo</th>
                <th className={th}>Estado</th>
                <th className={thNum}>Resultados</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => (
                <Fila key={e.evaluationId} e={e} puedeCerrar={puedeCerrar} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // TODAS SON HISTORIA: no se deja la tabla vacía, que se leería como "este paciente no tiene
        // evaluaciones" cuando tiene, y cerradas.
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay evaluaciones en curso. Las {plegadas.length} anteriores están más abajo.
        </div>
      )}

      {plegadas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVerTodas((v) => !v)}
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            {verTodas
              ? "Ocultar las terminadas"
              : `Ver las ${plegadas.length} terminadas o cerradas`}
          </button>
          {/* SE DICE QUE SIGUEN AHI. Un interruptor que esconde sin explicar deja la duda de si se
              borraron, y aqui nunca se borra nada. */}
          <span className="text-xs text-muted-foreground">
            No se borran: la historia clínica del paciente las conserva completas.
          </span>
        </div>
      ) : null}
    </div>
  );
}
