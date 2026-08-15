"use client";

import { Fragment } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  clasificarCintura,
  clasificarICC,
  clasificarICT,
  clasificarIMC,
} from "../anthropometry";
// El tipo Composition vive en composition-map (modulo NEUTRO, puro), NO en composition-reader
// (server-only): este componente es cliente y no debe arrastrar el reader al boundary de cliente.
import { clasificarAecMca, type Composition, type CompositionRow } from "../data/composition-map";
import { SEV_CLS } from "./risk-severity";

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
  sevByCode,
}: {
  rowKey: string;
  value: number | null;
  sexoM: boolean;
  classifications: Classifications;
  sevByCode: Record<string, number | null>;
}) {
  // Semaforo de 4 niveles (verde/ambar/naranja/rojo), igual que los badges del DFI. IMPORTANTE: usar
  // SEV_CLS y no OPTIMO_CLS aca: los clasificadores antropometricos SI emiten sev 1 (Sobrepeso, Riesgo CV
  // aumentado), y OPTIMO_CLS colapsaba 0 y 1 en verde -> "Sobrepeso" salia VERDE (defecto). SEV_CLS[1] es
  // ambar, como el HTML.
  const badge = (label: string, sev: number, title?: string) => (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEV_CLS[Math.min(3, Math.max(0, sev))]}`}
      title={title}
    >
      {label}
    </span>
  );
  // (a) antropometricas OMS (imc, cintura, ICT, ICC): referencia de display externa, rotulada via tooltip.
  const oms =
    rowKey === "imc"
      ? clasificarIMC(value)
      : rowKey === "cintura"
        ? clasificarCintura(value, sexoM)
        : rowKey === "ict"
          ? clasificarICT(value)
          : rowKey === "icc"
            ? clasificarICC(value, sexoM)
            : null;
  if (oms) return badge(oms.label, oms.sev, "Referencia médica estándar (OMS), no output del motor ANI-BIS-E.");
  // (a2) AEC/MCA (C12): clasificador de DISPLAY de Gildardo (dAECMCA, ATLAS_v7:12734).
  if (rowKey === "aec_mca") {
    const aec = clasificarAecMca(value);
    if (aec)
      return badge(
        aec.label,
        aec.sev,
        "Clasificación de display del prototipo de Gildardo (ANI-BIS-E), no umbral OMS ni output sellado del motor. Ver Q20.",
      );
  }
  // (b) clasificacion del motor (FFMI, AF, FMI, IR), coloreada con su severidad (semaforo). Antes iban en
  // texto plano; el HTML las colorea, y colorearlas es lo que hace la tabla legible de un vistazo (Santiago).
  if (rowKey === "FFMI" || rowKey === "AF" || rowKey === "FMI" || rowKey === "IR") {
    const label = classifications[rowKey]?.label;
    if (label) {
      const sev = sevByCode[rowKey];
      return sev != null ? badge(label, sev) : <span className="text-xs text-foreground">{label}</span>;
    }
  }
  // (c) sin clasificacion: guion neutro (ausencia, no "normal"). Se aclara una vez bajo la tabla.
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
  sevByCode = {},
  references = {},
  showDiagnosis = true,
}: {
  composition: Composition;
  sexoM?: boolean;
  classifications?: Classifications;
  // Severidad por codigo (del motor) para colorear el semaforo de FFMI/AF/FMI/IR en la columna Diagnostico.
  sevByCode?: Record<string, number | null>;
  // Referencia + Δ de los indicadores del motor que viven en Wang (FFMI/FMI/AF/IR): del clasificador del
  // motor (indicator-ranges), computadas en la pagina (tiene indicators). Rango COMPLETO (FFMI "17-25").
  references?: Record<string, { reference: string; delta: string | null }>;
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

  // Referencia y Δ de las filas antropometricas/derivadas (icc/ict/FMI): la referencia del EQUIPO es null
  // para ellas, asi que se llena con el UMBRAL/RANGO (OMS sexo-dependiente el ICC; motor el FMI) y la Δ va
  // contra ese corte (el FMI contra el punto medio del rango, como la tabla de indicadores). Las demas
  // filas conservan la referencia del equipo (poblacional, patient-specific): no se pierde informacion.
  // icc/ict: umbral OMS sexo-dependiente (su Δ va contra el corte). FMI/FFMI/AF/IR usan `references` (rango
  // del motor, pasado desde la pagina).
  const anthroRef: Record<string, { label: string; cut: number }> = {
    ict: { label: "<0.50", cut: 0.5 },
    icc: { label: sexoM ? "<0.90" : "<0.85", cut: sexoM ? 0.9 : 0.85 },
  };

  function renderRow(r: CompositionRow) {
    const dec = r.decimals ?? 2;
    const motorRef = references[r.key]; // FFMI/FMI/AF/IR: rango completo del motor + Δ ya formateado
    const a = anthroRef[r.key];
    const refText = motorRef
      ? motorRef.reference
      : a
        ? a.label
        : (r.referenceLabel ?? fmt(r.reference, dec));
    const refNum = a ? a.cut : r.reference;
    const deltaMotor = motorRef ? (motorRef.delta ?? "-") : null;
    const delta = r.value != null && refNum != null ? r.value - refNum : null;
    return (
      <tr key={r.key} className="border-b border-border/40 transition-colors hover:bg-muted/30">
        <td className="py-1.5 pr-4 text-foreground">
          {r.label}
          {r.unit ? <span className="text-muted-foreground"> ({r.unit})</span> : null}
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-foreground">{fmt(r.value, dec)}</td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">{refText}</td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
          {deltaMotor != null
            ? deltaMotor
            : delta == null
              ? "-"
              : `${delta >= 0 ? "+" : ""}${fmt(delta, dec)}`}
        </td>
        {showDiagnosis ? (
          <td className="py-1.5">
            <DiagnosisCell
              rowKey={r.key}
              value={r.value}
              sexoM={sexoM}
              classifications={classifications}
              sevByCode={sevByCode}
            />
          </td>
        ) : null}
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Los 3 chips (IMC/cintura/ICT) se retiraron: sus valores viven ahora en la tabla (Nivel V), con
          referencia y clasificacion, que es mas completo que un chip. La nota OMS que los acompañaba se
          movio al pie de la tabla (abajo), para no perder la aclaracion de que son referencia externa. */}
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
          <>
            <p className="text-xs text-muted-foreground">
              IMC, cintura, índice cintura-cadera (ICC) e índice cintura-talla (ICT) usan umbrales de
              referencia médica estándar (OMS), no un resultado del motor ANI-BIS-E.
            </p>
            <p className="text-xs text-muted-foreground">
              Varias variables de composición aún no tienen clasificación del motor (se muestran con un
              guion en Diagnóstico); disponibles próximamente.
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
