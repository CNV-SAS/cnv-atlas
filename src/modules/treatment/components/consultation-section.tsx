import { bloqueCls } from "@/components/shared/bloque";
import { FlaskConical, Info, ListChecks, Pill } from "lucide-react";

import type { ProtocoloSnapshot } from "@/clinical-engine";

import type { ConsultationRutaBlock } from "../services/consultation-content";

// Panel de CONSULTA por profesión (médica / ejercicio). SOLO LECTURA: el motor de prescripción de
// estas especialidades no existe en Atlas todavía (llega en una entrega posterior), y las escrituras
// de prescripción están reservadas al nutricionista. Reemplaza el aviso de "no disponible" por el
// contenido que ya se computa: el abordaje del rol, las indicaciones de su especialidad por ruta, y
// (solo médica) los exámenes y la suplementación sugeridos. La línea de alcance va en tamaño de
// cuerpo, no al pie: el profesional tiene que saber qué SÍ y qué NO puede hacer aquí (ajuste 1).

type Examen = ProtocoloSnapshot["examenes"][number];
type Suplemento = ProtocoloSnapshot["suplementacion"][number];

export function ConsultationSection({
  title,
  scope,
  abordaje,
  rutaBlocksTitle,
  rutaBlocks,
  examenes,
  suplementacion,
  protocolPending = false,
}: {
  title: string;
  scope: string;
  abordaje: string | null;
  rutaBlocksTitle: string;
  rutaBlocks: ConsultationRutaBlock[];
  // Solo el panel médico las pasa; el de ejercicio las omite.
  examenes?: Examen[];
  suplementacion?: Suplemento[];
  // true en el panel médico cuando aún no hay protocolo generado (los exámenes salen de ahí).
  protocolPending?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className={bloqueCls("derivado")}>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="flex items-start gap-2 text-sm text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="max-w-prose">{scope}</span>
        </p>
      </div>

      {abordaje ? (
        <div className="flex flex-col gap-1 rounded-xl border border-border p-4">
          <h4 className="text-sm font-semibold text-foreground">Abordaje para tu especialidad</h4>
          <p className="max-w-prose text-sm text-muted-foreground">{abordaje}</p>
        </div>
      ) : null}

      {rutaBlocks.length ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ListChecks className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {rutaBlocksTitle}
          </h4>
          {rutaBlocks.map((b) => (
            <div key={b.rutaId} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                {b.rutaId} · {b.rutaLabel}
                {b.urgencia ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (urgencia: {b.urgencia})
                  </span>
                ) : null}
              </span>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {b.indicaciones.map((ind, i) => (
                  <li key={i}>{ind}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {examenes !== undefined ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <FlaskConical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Exámenes sugeridos
          </h4>
          {examenes.length ? (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {examenes.map((e, i) => (
                <li key={i}>
                  <span className="font-medium text-foreground">{e.nombre}</span> — {e.razon} (
                  {e.protocolo}, prioridad {e.prioridad})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {protocolPending
                ? "Los exámenes sugeridos aparecen cuando el protocolo del paciente está generado."
                : "Sin exámenes sugeridos para este estado."}
            </p>
          )}
        </div>
      ) : null}

      {suplementacion !== undefined && suplementacion.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Pill className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Suplementación sugerida
          </h4>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {suplementacion.map((s, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{s.nombre}</span> {s.dosis} — {s.razon}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
