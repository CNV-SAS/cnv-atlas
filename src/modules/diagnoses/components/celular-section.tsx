import { Panel } from "@/components/shared/panel";
import type { CelularBadges } from "../data/celular-badges";

// Nivel III · Salud celular. VIVE EN DIAGNOSTICO desde 2026-08-23, por decision de Gildardo: hidratacion
// celular, angulo de fase y masa celular activa son HALLAZGOS, no conducta; en Tratamiento van las rutas y
// el tratamiento de cada profesional.
//
// De donde salio antes de estar aqui (el nos lo pregunto): de SU archivo. `celBadges` esta en la entrega
// vigente (ATLAS_v8.html 2026-08-19) en la linea 17126, DENTRO de la subpestaña del nutricionista de
// Tratamiento (plan_nutricional abre en 16595; la del medico en 17184). No se movio por interpretacion: se
// porto de donde estaba, y quien lo movio a Diagnostico fue el.
//
// Modulo NEUTRO (sin "use client" ni server-only): presentacional puro, lo renderiza la page server.

// Tono de la badge celular. warn/alert usan tokens de BRAND; info (hidratacion) un cian estandar.
const CEL_TONE_CLS: Record<CelularBadges["badges"][number]["tone"], string> = {
  warn: "border-clinical-warning/40 bg-clinical-warning-bg text-clinical-warning",
  alert: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-sky-500/40 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
};

// Nivel III · Salud celular (portado del vigente, celBadges). TRES estados que se distinguen a
// proposito (misma disciplina que el menu deshabilitado): (1) badges de alteracion; (2) datos
// presentes y ninguna alteracion -> se DICE ("sin alteraciones"); (3) sin las columnas necesarias
// -> "no se pudo evaluar", que NO es lo mismo que "sin alteraciones".
export function CelularSection({ celular }: { celular?: CelularBadges | null }) {
  if (!celular) return null; // sin medicion BIS: no hay seccion (tampoco habria protocolo).
  return (
    <Panel>
      <h3 className="text-sm font-semibold text-foreground">Nivel III · Salud celular</h3>
      {!celular.dataAvailable ? (
        <p className="text-sm text-muted-foreground">
          Esta medicion BIS no incluye los parametros necesarios para evaluar la salud celular
          (angulo de fase, MCA, hidratacion, ECM/BCM).
        </p>
      ) : (
        <>
          {celular.badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {celular.notEvaluable.length > 0
                ? "Sin alteraciones en los parámetros evaluados."
                : "Sin alteraciones celulares que requieran priorizacion."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {celular.badges.map((b) => (
                <li
                  key={b.id}
                  className={`flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm ${CEL_TONE_CLS[b.tone]}`}
                >
                  <span className="font-semibold">{b.label}</span>
                  <span className="text-foreground/80">{b.guidance}</span>
                </li>
              ))}
            </ul>
          )}
          {/* No evaluables por falta de referencia (no de dato): que "sin alteraciones" no se lea como
              si estos parametros se hubieran evaluado. La referencia la debe Gildardo (Q35). */}
          {celular.notEvaluable.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              No evaluables aun (esperan las referencias poblacionales del modelo):{" "}
              {celular.notEvaluable.map((n) => n.label).join(", ")}.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}
