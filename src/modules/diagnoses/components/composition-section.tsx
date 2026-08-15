"use client";

import { Fragment } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  type AnthroClass,
  clasificarCintura,
  clasificarICT,
  clasificarIMC,
} from "../anthropometry";
// El tipo Composition vive en composition-map (modulo NEUTRO, puro), NO en composition-reader
// (server-only): este componente es cliente y no debe arrastrar el reader al boundary de cliente.
import { clasificarAecMca, type Composition, type CompositionRow } from "../data/composition-map";
import { OPTIMO_CLS } from "./risk-severity";

// Composicion corporal (Niveles de Wang) + clasificacion antropometrica de referencia. Todo desde
// bis_raw_values (inmutable por medicion), no del registry vivo. La clasificacion antropometrica
// es REFERENCIA MEDICA ESTANDAR (OMS), NO output del motor ANI-BIS-E: se rotula como tal.

// Color por severidad de la clasificacion antropometrica: escala de 3 (optimo verde / alerta ambar /
// critico rojo) desde la fuente unica (OPTIMO_CLS). NO usa el azul del DFI: el azul (excellent) es
// exclusivo del mejor nivel del DFI (Bajo); aqui el mejor es optimo = verde. Ver risk-severity.

// Dos decimales por defecto (Gildardo usa dos; en composicion la segunda cifra importa). El guard de
// entero evita "80.00" donde no aporta; la referenceLabel (cadenas como "<0.45") no pasa por aqui.
function fmt(v: number | null, dec = 2): string {
  if (v == null) return "-";
  return Number.isInteger(v) ? String(v) : v.toFixed(dec);
}

// Grupos de detalle colapsables: cada uno mapea a un parametro de URL (persiste al cambiar de subpestaña
// y volver, igual que ?sub; un useState se reiniciaria porque el subpanel se desmonta). Rotulos que DICEN
// que contienen, no "ver mas".
const DETAIL_GROUPS: Record<
  "agua" | "bioelectrico",
  { param: string; open: string; closed: string }
> = {
  agua: {
    param: "agua",
    open: "Ocultar desglose de agua",
    closed: "Ver desglose de agua (con/sin grasa, L y %)",
  },
  bioelectrico: {
    param: "bio",
    open: "Ocultar parámetros bioeléctricos crudos",
    closed: "Ver parámetros bioeléctricos crudos",
  },
};

function AnthroChip({ label, cls }: { label: string; cls: AnthroClass | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      {cls ? (
        <span
          className={`w-fit rounded-md px-2 py-0.5 text-sm font-semibold ${OPTIMO_CLS[Math.min(3, Math.max(0, cls.sev))]}`}
        >
          {cls.label}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Sin dato</span>
      )}
    </div>
  );
}

type Classifications = Record<string, { label?: string } | null>;

// Diagnostico por fila de la tabla de Wang. Disponible HOY: (a) antropometricas por umbral OMS
// (imc/cintura) y (b) las clasificaciones del motor ya congeladas en el snapshot (FFMI/AF). El
// resto queda como PENDIENTE EXPLICITO: nunca un guion silencioso, que un profesional podria leer
// como "el modelo evaluo esto y salio normal" (falso). Ver docs/RESULTADOS_GAP.md Parte 4 y Q10.
function DiagnosisCell({
  rowKey,
  value,
  sexoM,
  classifications,
}: {
  rowKey: string;
  value: number | null;
  sexoM: boolean;
  classifications: Classifications;
}) {
  // (a) antropometricas OMS (referencia de display, rotulada como tal via tooltip).
  const oms = rowKey === "imc" ? clasificarIMC(value) : rowKey === "cintura" ? clasificarCintura(value, sexoM) : null;
  if (oms) {
    return (
      <span
        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${OPTIMO_CLS[Math.min(3, Math.max(0, oms.sev))]}`}
        title="Referencia médica estándar (OMS), no output del motor ANI-BIS-E."
      >
        {oms.label}
      </span>
    );
  }
  // (a2) AEC/MCA (C12): clasificador de DISPLAY de Gildardo (dAECMCA, ATLAS_v7:12734), no OMS ni
  // motor sellado. Rotulado como tal; Q20 (familia c vs d) sigue abierta.
  if (rowKey === "aec_mca") {
    const aec = clasificarAecMca(value);
    if (aec) {
      return (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${OPTIMO_CLS[Math.min(3, Math.max(0, aec.sev))]}`}
          title="Clasificación de display del prototipo de Gildardo (ANI-BIS-E), no umbral OMS ni output sellado del motor. Ver Q20."
        >
          {aec.label}
        </span>
      );
    }
  }
  // (b) clasificacion del motor congelada en el snapshot (FFMI, AF).
  const snap =
    rowKey === "FFMI" ? classifications.FFMI : rowKey === "AF" ? classifications.AF : null;
  if (snap?.label) {
    return <span className="text-xs text-foreground">{snap.label}</span>;
  }
  // (c) sin clasificacion del motor: guion neutro. La ausencia se comunica UNA vez a nivel de
  // seccion (nota bajo la tabla), no se repite por fila.
  return <span className="text-muted-foreground">-</span>;
}

// showDiagnosis gobierna si se muestra el VEREDICTO (clasificacion antropometrica OMS + columna
// Diagnostico). En Diagnostico es true (el veredicto es su materia). En Evaluacion es false: la
// etapa de entrada muestra "que entro" (Variable, Valor, Referencia, Δ), no el veredicto (ese es de
// Diagnostico). Un solo componente, sin duplicar. Cuando es false, sexoM/classifications no se usan.
export function CompositionSection({
  composition,
  sexoM = true,
  classifications = {},
  showDiagnosis = true,
}: {
  composition: Composition;
  sexoM?: boolean;
  classifications?: Classifications;
  showDiagnosis?: boolean;
}) {
  // Estado de colapso EN LA URL (?agua=1&bio=1): persiste al cambiar de subpestaña y volver (el subpanel
  // desmonta este arbol, un useState se reiniciaria). Mismo mecanismo que ?sub: history.replaceState NO
  // re-pide el RSC (Next 16 sincroniza useSearchParams), conmutar es instantaneo.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const colCount = showDiagnosis ? 5 : 4;
  // El nivel Bioelectrico (Cole-Cole) son valores CRUDOS del equipo (resistencias, reactancia, Fo,
  // impedancias), sin diagnostico. En DIAGNOSTICO no van (el HTML no los tiene ahi): viven en EVALUACION,
  // donde esta lo medido. showDiagnosis=false (Evaluacion) los muestra; true (Diagnostico) los oculta.
  const visibleLevels = showDiagnosis
    ? composition.levels.filter((l) => !l.title.startsWith("Bioeléctrico"))
    : composition.levels;

  function toggleGroup(param: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get(param) === "1") params.delete(param);
    else params.set(param, "1");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  function renderRow(r: CompositionRow) {
    const dec = r.decimals ?? 2;
    const delta = r.value != null && r.reference != null ? r.value - r.reference : null;
    return (
      <tr key={r.key} className="border-b border-border/40 transition-colors hover:bg-muted/30">
        <td className="py-1.5 pr-4 text-foreground">
          {r.label}
          {r.unit ? <span className="text-muted-foreground"> ({r.unit})</span> : null}
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-foreground">{fmt(r.value, dec)}</td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
          {r.referenceLabel ?? fmt(r.reference, dec)}
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
          {delta == null ? "-" : `${delta >= 0 ? "+" : ""}${fmt(delta, dec)}`}
        </td>
        {showDiagnosis ? (
          <td className="py-1.5">
            <DiagnosisCell rowKey={r.key} value={r.value} sexoM={sexoM} classifications={classifications} />
          </td>
        ) : null}
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {showDiagnosis ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-foreground">Clasificación antropométrica</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AnthroChip label={`IMC ${fmt(composition.imc)}`} cls={clasificarIMC(composition.imc)} />
            <AnthroChip
              label={`Cintura ${fmt(composition.cintura, 0)} cm`}
              cls={clasificarCintura(composition.cintura, sexoM)}
            />
            <AnthroChip
              label={`Índice cintura-talla ${fmt(composition.ict, 2)}`}
              cls={clasificarICT(composition.ict)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Umbrales de referencia médica estándar (OMS): IMC, circunferencia de cintura e índice
            cintura-talla. Son referencia clínica general, no un resultado del motor ANI-BIS-E.
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-foreground">
          Composición corporal - Niveles de Wang
        </h3>
        <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Variable</th>
                  <th className="py-2 pr-4 text-right font-medium">Valor</th>
                  <th className="py-2 pr-4 text-right font-medium">Referencia</th>
                  <th className="py-2 pr-4 text-right font-medium">Δ</th>
                  {showDiagnosis ? <th className="py-2 font-medium">Diagnóstico</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleLevels.map((lvl) => {
                  const primary = lvl.rows.filter((r) => !r.detail);
                  // Grupos de detalle presentes en el nivel, en orden de aparicion (hoy uno por nivel).
                  const groups = [
                    ...new Set(lvl.rows.filter((r) => r.detail).map((r) => r.detail!)),
                  ];
                  return (
                    <Fragment key={lvl.title}>
                      {/* Header de nivel: banda neutra ESTRUCTURAL (no color de riesgo; ver
                          BRAND.md, matiz de reserva del color de riesgo). */}
                      <tr className="border-y border-border bg-muted">
                        <td
                          colSpan={colCount}
                          className="py-2 text-xs font-semibold uppercase tracking-wider text-foreground"
                        >
                          {lvl.title}
                        </td>
                      </tr>
                      {primary.map(renderRow)}
                      {groups.map((g) => {
                        const meta = DETAIL_GROUPS[g];
                        const open = searchParams.get(meta.param) === "1";
                        return (
                          <Fragment key={g}>
                            <tr className="border-b border-border/40">
                              <td colSpan={colCount} className="py-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(meta.param)}
                                  aria-expanded={open}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                >
                                  {open ? (
                                    <ChevronDown className="size-3.5" aria-hidden />
                                  ) : (
                                    <ChevronRight className="size-3.5" aria-hidden />
                                  )}
                                  {open ? meta.open : meta.closed}
                                </button>
                              </td>
                            </tr>
                            {open ? lvl.rows.filter((r) => r.detail === g).map(renderRow) : null}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        {composition.hasDerivedValues ? (
          <p className="text-xs text-muted-foreground">
            Algunos valores de composición se reconstruyen a partir de la medición cuando el equipo no
            los exporta, siguiendo el modelo ANI-BIS-E. Por eso puedes ver variables que no aparecían
            en la pantalla del equipo.
          </p>
        ) : null}
        {showDiagnosis ? (
          <p className="text-xs text-muted-foreground">
            Varias variables de composición aún no tienen clasificación del motor (se muestran con un
            guion en Diagnóstico); disponibles próximamente.
          </p>
        ) : null}
      </section>
    </div>
  );
}
