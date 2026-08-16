"use client";

import { Fragment } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";

// El tipo Composition vive en composition-map (modulo NEUTRO, puro), NO en composition-reader
// (server-only): este componente es cliente y no debe arrastrar el reader al boundary de cliente.
import { type Composition, type CompositionRow } from "../data/composition-map";
import {
  computeRefPob,
  type DisplayDx,
  type RefPobEntry,
  wangRowDx,
} from "../data/composition-display";
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

// Semaforo de 4 niveles (verde/ambar/naranja/rojo), igual que los badges del DFI. IMPORTANTE: SEV_CLS y no
// OPTIMO_CLS: los clasificadores de display SI emiten sev 1 (Sobrepeso, Riesgo CV aumentado), y OPTIMO_CLS
// colapsaba 0 y 1 en verde -> "Sobrepeso" salia VERDE (defecto). SEV_CLS[1] es ambar, como el HTML.
function DxBadge({ dx, title }: { dx: DisplayDx; title?: string }) {
  if (!dx) return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEV_CLS[Math.min(3, Math.max(0, dx.sev))]}`}
      title={title}
    >
      {dx.label}
    </span>
  );
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
  fenotipoMccb = null,
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
  // Fenotipo MCCB (FFMI x FMI), del snapshot sellado: se muestra como ULTIMA fila del Nivel IV, como en el
  // HTML de Gildardo (smoke Santiago d). No sale del mapa PURO (es salida del diagnostico); lo pasa la pagina.
  fenotipoMccb?: { id: string; nombre: string } | null;
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

  // Valores por clave (para el contexto cruzado de NHLBI/Mapa AFxIR: af/ir salen de otras filas).
  const valueMap: Record<string, number | null> = {};
  for (const l of composition.levels) for (const row of l.rows) valueMap[row.key] = row.value;
  const diagCtx = {
    imc: composition.imc,
    cintura: composition.cintura,
    af: valueMap["AF"] ?? null,
    ir: valueMap["IR"] ?? null,
  };

  // REF_POB (referencias poblacionales de ultimo recurso, capa de display de Gildardo): rellena los `*_ref`
  // que el equipo NO trajo, para que la columna Referencia (y con ella el Δ y el diagnostico) no queden
  // vacios. Las derivadas de constantes NO validadas van marcadas "en validacion" (Gildardo dijo "validar",
  // no "no mostrar"; su HTML las usa). Las referencias/Δ salen de wangRowDx (FUENTE UNICA) en Evaluacion Y
  // Diagnostico (Santiago 2026-08-15: la tabla de Evaluacion sin referencias eran solo numeros crudos,
  // justo lo que criticabamos; reusar la misma fuente evita dos tablas divergiendo). `showDiagnosis` gatea
  // SOLO la columna Diagnostico, no las referencias.
  const refMap: Record<string, number | null> = {};
  for (const l of composition.levels)
    for (const row of l.rows) if (row.refKey) refMap[row.refKey] = row.reference;
  const refPob: Record<string, RefPobEntry> = computeRefPob(
    composition.peso,
    composition.talla,
    sexoM,
    (k) => refMap[k] ?? null,
  );
  // Filas que REALMENTE muestran el "*" de REF_POB en validacion: solo las de referencia NUMERICA
  // poblacional (valor-vs-referencia o crudas), NO las de banda (que muestran el rango normativo). Se
  // derivan una vez y se reusan para el pie: la nota no se afirma si ninguna fila la muestra (leccion de
  // texto que afirma un estado sin derivarlo; una banda con "*" no tiene REF_POB detras).
  const starKeys = new Set<string>();
  for (const l of composition.levels)
    for (const r of l.rows) {
      const rpe = r.reference == null && r.refKey ? refPob[r.refKey] : undefined;
      if (!rpe?.enValidacion || r.key === "FMI") continue;
      const effRef = r.reference ?? rpe.value ?? null;
      const w = wangRowDx(r.key, r.value, sexoM, diagCtx, effRef, (v) => fmt(v));
      // refIsNumeric: banda -> cut fijo != effRef; valor-vs-ref -> cut === effRef; cruda (w null) -> numerica.
      if (w ? w.cut === effRef : true) starKeys.add(r.key);
    }
  const hayEnValidacion = starKeys.size > 0;

  // FUENTE UNICA por fila: Referencia + Δ + Diagnostico salen de wangRowDx (capa de display), NO se escriben
  // a mano al lado del clasificador (ese desajuste dejaba celdas vacias, ver leccion). UNICA excepcion: FMI,
  // que manda el MOTOR (rango 3-6, no el 6-9 del display): su ref/Δ/clase vienen de `references`/`classifications`.
  function renderRow(r: CompositionRow) {
    const dec = r.decimals ?? 2;
    const isFmi = r.key === "FMI";
    // Referencia EFECTIVA (equipo, o REF_POB si el equipo no la trajo) para las filas valor-vs-referencia.
    const refPobEntry = r.reference == null && r.refKey ? refPob[r.refKey] : undefined;
    const effectiveRef = r.reference ?? refPobEntry?.value ?? null;
    const w = !isFmi
      ? wangRowDx(r.key, r.value, sexoM, diagCtx, effectiveRef, (v) => fmt(v, dec))
      : null;

    // Columna Referencia
    const motorRef = references[r.key]; // FMI (y FFMI/AF/IR si no hay display): rango del motor + Δ formateado
    const refText = isFmi && motorRef
      ? motorRef.reference
      : w
        ? w.referenceLabel
        : (r.referenceLabel ?? fmt(effectiveRef, dec));
    // El "*" de REF_POB "en validacion" se derivo una vez en starKeys (solo referencias numericas, no bandas).
    const showStar = starKeys.has(r.key);

    // Columna Valor: casi siempre el numero; NHLBI muestra la clase, Mapa AFxIR el perfil "IR .. · AF ..".
    const valueText = w?.valueText ?? fmt(r.value, dec);

    // Columna Δ: FMI del motor; NHLBI su texto de cintura. El resto: en Diagnostico contra el corte normativo
    // (wangRowDx.cut); en Evaluacion (o filas crudas sin clasificador) contra la referencia del equipo.
    let deltaText: string;
    if (isFmi && motorRef) deltaText = motorRef.delta ?? "-";
    else if (w?.deltaText != null) deltaText = w.deltaText;
    else {
      const cut = w ? w.cut : effectiveRef;
      const d = r.value != null && cut != null ? r.value - cut : null;
      deltaText = d == null ? "-" : `${d >= 0 ? "+" : ""}${fmt(d, dec)}`;
    }

    // Columna Diagnostico
    const dxNode = !showDiagnosis ? null : isFmi ? (
      <DxBadge
        dx={
          classifications["FMI"]?.label
            ? { label: classifications["FMI"]!.label!, sev: sevByCode["FMI"] ?? 0 }
            : null
        }
      />
    ) : (
      <DxBadge dx={w?.dx ?? null} />
    );

    return (
      <tr key={r.key} className="border-b border-border/40 transition-colors hover:bg-muted/30">
        <td className="py-1.5 pr-4 text-foreground">
          {r.label}
          {r.unit ? <span className="text-muted-foreground"> ({r.unit})</span> : null}
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-foreground">{valueText}</td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
          {refText}
          {showStar ? (
            <sup
              className="ml-0.5 text-clinical-warning"
              title="Referencia en validación por la Dirección Científica (no significa que el dato esté mal)."
            >
              *
            </sup>
          ) : null}
        </td>
        <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">{deltaText}</td>
        {showDiagnosis ? <td className="py-1.5">{dxNode}</td> : null}
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
                      {/* Fenotipo MCCB (FFMI x FMI) como ultima fila del Nivel IV (smoke Santiago d): valor y
                          diagnostico = el nombre del fenotipo; sin referencia ni Δ (es una clasificacion, no un
                          numero), igual que el HTML. Solo en Diagnostico y si el snapshot lo trae. */}
                      {showDiagnosis && fenotipoMccb && lvl.title.includes("Tejidos") ? (
                        <tr className="border-b border-border/40">
                          <td className="py-1.5 pr-4 text-foreground">Fenotipo MCCB (FFMI×FMI)</td>
                          <td className="py-1.5 pr-4 text-right text-foreground">{fenotipoMccb.nombre}</td>
                          <td className="py-1.5 pr-4 text-right text-muted-foreground">—</td>
                          <td className="py-1.5 pr-4 text-right text-muted-foreground">—</td>
                          <td className="py-1.5 text-foreground">{fenotipoMccb.nombre}</td>
                        </tr>
                      ) : null}
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
            {hayEnValidacion ? (
              <p className="text-xs text-clinical-warning">
                <span className="font-semibold">*</span> Referencia poblacional en validación por la
                Dirección Científica (se deriva de peso, talla y sexo cuando el equipo no la trae). No
                significa que el dato esté mal: espera confirmación.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              IMC, cintura, índice cintura-cadera (ICC) e índice cintura-talla (ICT) usan umbrales de
              referencia médica estándar (OMS), no un resultado del motor ANI-BIS-E.
            </p>
            <p className="text-xs text-muted-foreground">
              Las masas crudas (kg) muestran un guion en Diagnóstico: se contrastan contra la referencia
              del equipo, sin una clasificación normativa propia (igual que en la tabla de referencia).
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
