"use client";

import { Fragment } from "react";
import { Zap } from "lucide-react";

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
//
// DOS DISPOSICIONES (Santiago + Gildardo 2026-08-17): la MISMA seccion sirve las dos tablas, pero cada una
// tiene sus PROPIAS filas y orden (composition.eval vs composition.diag), no una sola con una columna que se
// apaga. `showDiagnosis` elige la disposicion Y muestra la columna Diagnostico. Asi una tabla no arrastra
// filas de la otra (care Santiago a).

// Color por severidad de la clasificacion antropometrica: escala de 3 (optimo verde / alerta ambar /
// critico rojo) desde la fuente unica (OPTIMO_CLS). NO usa el azul del DFI: el azul (excellent) es
// exclusivo del mejor nivel del DFI (Bajo); aqui el mejor es optimo = verde. Ver risk-severity.

// Dos decimales por defecto (Gildardo usa dos; en composicion la segunda cifra importa). El guard de
// entero evita "80.00" donde no aporta; la referenceLabel (cadenas como "<0.45") no pasa por aqui.
function fmt(v: number | null, dec = 2): string {
  if (v == null) return "-";
  return Number.isInteger(v) ? String(v) : v.toFixed(dec);
}

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

// showDiagnosis gobierna DOS cosas: (1) que disposicion se muestra (diag = clasificada; eval = medida/cruda)
// y (2) si se muestra el VEREDICTO (clasificacion antropometrica OMS + columna Diagnostico). En Diagnostico
// es true (el veredicto es su materia). En Evaluacion es false: la etapa de entrada muestra "que entro"
// (Variable, Valor, Referencia, Δ), no el veredicto. Un solo componente, sin duplicar.
export function CompositionSection({
  composition,
  sexoM = true,
  classifications = {},
  sevByCode = {},
  references = {},
  fenotipoMccb = null,
  showDiagnosis = true,
  soloAlterados = false,
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
  /** Historia clinica: muestra SOLO las filas con clasificacion alterada (sev >= 1). */
  soloAlterados?: boolean;
}) {
  const colCount = showDiagnosis ? 5 : 4;
  // Disposicion segun el proposito de la tabla: Diagnostico muestra lo clasificado; Evaluacion lo medido y
  // crudo (con el bioelectrico repartido en su nivel). Las dos vienen listas del mapa, sin filtrar aqui.
  const activeLevels = showDiagnosis ? composition.diag : composition.eval;

  // Valores/referencias por clave del UNION de ambas disposiciones: NHLBI/Mapa AFxIR necesitan af/ir (de
  // otras filas) y la resolucion de REF_POB necesita las referencias del equipo aunque la fila que las trae
  // viva en la otra tabla. Se leen de las dos disposiciones; render usa solo la activa.
  const valueMap: Record<string, number | null> = {};
  const refMap: Record<string, number | null> = {};
  for (const layout of [composition.eval, composition.diag])
    for (const l of layout)
      for (const row of l.rows) {
        valueMap[row.key] = row.value;
        if (row.refKey) refMap[row.refKey] = row.reference;
      }
  const diagCtx = {
    imc: composition.imc,
    cintura: composition.cintura,
    af: valueMap["AF"] ?? null,
    ir: valueMap["IR"] ?? null,
  };

  // REF_POB (referencias poblacionales de ultimo recurso, capa de display de Gildardo): rellena los `*_ref`
  // que el equipo NO trajo, para que la columna Referencia (y con ella el Δ y el diagnostico) no queden
  // vacios. Las derivadas de constantes NO validadas van marcadas "en validacion". Las referencias/Δ salen
  // de wangRowDx (FUENTE UNICA) en Evaluacion Y Diagnostico. `showDiagnosis` gatea SOLO la columna Diagnostico.
  const refPob: Record<string, RefPobEntry> = computeRefPob(
    composition.peso,
    composition.talla,
    sexoM,
    (k) => refMap[k] ?? null,
  );
  // Filas que REALMENTE muestran el "*" de REF_POB en validacion: solo las de referencia NUMERICA
  // poblacional (valor-vs-referencia o crudas), NO las de banda (que muestran el rango normativo). Se
  // derivan una vez, SOLO sobre la disposicion activa (una fila que no se muestra no enciende el pie).
  const starKeys = new Set<string>();
  for (const l of activeLevels)
    for (const r of l.rows) {
      const rpe = r.reference == null && r.refKey ? refPob[r.refKey] : undefined;
      if (!rpe?.enValidacion || r.key === "FMI") continue;
      const effRef = r.reference ?? rpe.value ?? null;
      const w = wangRowDx(r.key, r.value, sexoM, diagCtx, effRef, (v) => fmt(v));
      // refIsNumeric: banda -> cut fijo != effRef; valor-vs-ref -> cut === effRef; cruda (w null) -> numerica.
      if (w ? w.cut === effRef : true) starKeys.add(r.key);
    }
  const hayEnValidacion = starKeys.size > 0;

  // FILTRO "SOLO ALTERADOS" (bloque 4 de la historia clinica, 2026-08-24). Es la MISMA tabla, no otra mas
  // corta: su HC pinta las mismas filas y oculta las normales y las sin clasificar. La regla, con sus
  // palabras: "mostrar items alterados (naranja=riesgo, rojo=alto, azul=deficit); ocultar solo los normales
  // (verde) y sin clasificacion". Traducida a nuestra escala: se muestra sev >= 1 (0 es el unico optimo).
  //
  // El sentido clinico es el que hace que valga la pena portarlo: la HISTORIA muestra lo que esta mal, el
  // DIAGNOSTICO muestra todo. Un documento que se imprime y se archiva no es una hoja de trabajo.
  function dxDeFila(r: CompositionRow): { label: string; sev: number } | null {
    if (r.key === "FMI") {
      const label = classifications["FMI"]?.label;
      return label ? { label, sev: sevByCode["FMI"] ?? 0 } : null;
    }
    const rpe = r.reference == null && r.refKey ? refPob[r.refKey] : undefined;
    const effRef = r.reference ?? rpe?.value ?? null;
    return wangRowDx(r.key, r.value, sexoM, diagCtx, effRef, (v) => fmt(v, r.decimals ?? 2))?.dx ?? null;
  }

  // El filtro deja fuera DOS cosas mas, y las dos salen del cotejo del 2026-08-24 contra su HC:
  //
  // 1. El COMPARADOR GENERICO ("Por encima/Por debajo de la referencia"). No es un veredicto clinico: es
  //    un contraste contra una referencia que en muchas filas es POBLACIONAL y esta EN VALIDACION por la
  //    Direccion Cientifica (las que llevan el asterisco). Listar "AEC por debajo de la referencia" como
  //    indice ALTERADO en un documento clinico, sobre una referencia que ni siquiera esta confirmada, es
  //    afirmar mas de lo que sabemos. En el Diagnostico sigue mostrandose (ahi se mira el caso vivo).
  // 2. Las filas SIN valor. Una fila sin dato no puede estar alterada.
  //
  // Efecto medido en el smoke: la tabla pasaba de trece filas a las que de verdad dicen algo. Su HC ni
  // siquiera tiene esas filas (su tabla son veinte indices concretos), asi que esto nos ACERCA a su
  // documento, no nos aleja.
  const COMPARADOR_GENERICO = /^por (encima|debajo) de la referencia$/i;

  const levelsToRender = soloAlterados
    ? activeLevels
        .map((l) => ({
          ...l,
          rows: l.rows.filter((r) => {
            if (r.value == null) return false;
            const d = dxDeFila(r);
            if (!d || d.sev < 1) return false;
            return !COMPARADOR_GENERICO.test(d.label);
          }),
        }))
        .filter((l) => l.rows.length > 0)
    : activeLevels;

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
          {/* El icono de rayo distingue el parametro bioelectrico crudo cuando queda entre filas de
              composicion en su nivel (care Santiago b): viaja con la fila, no depende de la posicion. */}
          {r.bioelectric ? (
            <Zap
              className="mr-1.5 inline-block size-3.5 shrink-0 -translate-y-px text-primary"
              aria-label="Parámetro bioeléctrico"
            />
          ) : null}
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
              {levelsToRender.map((lvl) => (
                <Fragment key={lvl.title}>
                  {/* Header de nivel: banda neutra ESTRUCTURAL (no color de riesgo; ver BRAND.md, matiz
                      de reserva del color de riesgo). */}
                  <tr className="border-y border-border bg-muted">
                    <td
                      colSpan={colCount}
                      className="py-2 text-xs font-semibold uppercase tracking-wider text-foreground"
                    >
                      {lvl.title}
                    </td>
                  </tr>
                  {lvl.rows.map(renderRow)}
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
                </Fragment>
              ))}
              {/* Como en su HC: si NADA esta alterado se dice, en vez de dejar la tabla vacia (una tabla
                  vacia se lee como dato faltante, no como "todo en rango"). */}
              {soloAlterados && levelsToRender.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-3 text-sm italic text-muted-foreground">
                    Sin índices alterados: todos los valores medidos están en rango normal.
                  </td>
                </tr>
              ) : null}
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
        {/* El pie del "*" se muestra en AMBAS tablas: las referencias (y su marca de validacion) ahora
            viven tambien en Evaluacion. Solo se afirma si alguna fila mostrada lleva el "*". */}
        {hayEnValidacion ? (
          <p className="text-xs text-clinical-warning">
            <span className="font-semibold">*</span> Referencia poblacional en validación por la
            Dirección Científica (se deriva de peso, talla y sexo cuando el equipo no la trae). No
            significa que el dato esté mal: espera confirmación.
          </p>
        ) : null}
        {showDiagnosis ? (
          <p className="text-xs text-muted-foreground">
            IMC, cintura, índice cintura-cadera (ICC) e índice cintura-talla (ICT) usan umbrales de
            referencia médica estándar (OMS), no un resultado del motor ANI-BIS-E.
          </p>
        ) : null}
      </section>
    </div>
  );
}
