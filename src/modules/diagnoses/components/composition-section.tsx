"use client";

import { Panel } from "@/components/shared/panel";
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
import { decimalesEsp, fmtDec } from "@/lib/format/decimal";

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
// Coma decimal (lib/format/decimal): esta tabla convive con las tarjetas del DFI, que traen las cadenas
// del motor ya en español. Con toFixed crudo la pantalla mezclaba los dos separadores.
function fmt(v: number | null, dec = 2): string {
  if (v == null) return "-";
  return fmtDec(v, dec);
}

// ═══ DIRECCION DE LA Δ: PORTE DE SU `difCell` (entrega vigente del 4 de septiembre, linea 7392) ═══
//
//   const esMalo = invertido ? d > 0 : d < 0;
//
// O sea: por defecto SUBIR es lo favorable (mas masa magra, mas agua, mas mineral oseo), y en unas pocas
// filas es al reves. Estas son esas filas, con su tercer argumento en `true`. Se escriben aqui y el
// candado `delta-direccion-de-su-archivo.test.ts` las DERIVA de su HTML vigente y las compara: una lista a
// mano sin nada que la coteje es exactamente lo que envejece en silencio cuando el manda otra entrega.
//
// `peso` entra por la fila de la meta: `difCell(peso, pesoMeta, true)`. Pasarse de la meta es el lado
// adverso, igual que pasarse de cintura o de masa grasa.
const SUBIR_ES_ADVERSO = new Set(["peso", "cintura", "FM", "FM_pct", "FM_hid"]);

/**
 * Color de una Δ segun de que lado de su referencia cae. Devuelve la clase de la CAPA DE INTERFAZ
 * (`--delta-*`), nunca `--clinical-*`: una Δ direccional no es un veredicto sobre el paciente.
 *
 * Solo se usa en la tabla SIN columna de Diagnostico, que es la regla de su archivo: en Antropometria la Δ
 * es la unica senal de direccion que hay, y en Diagnostico el color lo lleva el badge de veredicto (su
 * Diagnostico pinta las deltas en gris, verificado en la captura).
 */
function colorDeDelta(d: number | null, rowKey: string): string {
  if (d == null || Math.abs(d) < 0.001) return "text-muted-foreground";
  const adverso = SUBIR_ES_ADVERSO.has(rowKey) ? d > 0 : d < 0;
  return adverso ? "text-delta-adversa" : "text-delta-favorable";
}

type Classifications = Record<string, { label?: string } | null>;

/** Una fila del bloque final (ver `bloqueFinal`). Trae ya lo que se pinta, no numeros que clasificar. */
export type FilaBloqueFinal = {
  id: string;
  etiqueta: string;
  /** Sigla debajo del nombre, cuando el indice tiene las dos cosas. */
  sigla?: string | null;
  valor: string;
  referencia: string;
  delta: string;
  clasificacion: string;
  /**
   * Severidad de SU clasificacion (0 optimo .. 3 critico). Sin ella el veredicto salia en un chip gris
   * mientras los de las filas de al lado iban en color, en la misma tabla y sobre el mismo paciente
   * (Santiago, 2026-09-10). Un veredicto sin color no es mas neutro: es uno que parece no clasificado.
   */
  sev: number;
};

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
  // El titulo se OCULTA cuando el bloque ya viene envuelto en algo que lo titula (la entrada de la
  // evaluacion lo mete en un DetailsSection que dice "Composición corporal (Niveles de Wang)"). Sin
  // esto salia dos veces, casi con el mismo texto. En Diagnostico se usa suelto, asi que ahi si va.
  showTitle = true,
  soloAlterados = false,
  pesoMetaKg = null,
  bloqueFinal = null,
}: {
  composition: Composition;
  /**
   * Meta de peso acordada (kg). Es la REFERENCIA de la fila de Peso, como en su archivo: no crea columna.
   * Se lee de `evaluations.weight_goal_kg`; aqui NO se escribe nada, y no viaja al snapshot ni al PDF.
   * null (lo normal) = la fila de Peso se queda sin referencia, como estaba. Ver el bloque de abajo.
   */
  pesoMetaKg?: number | null;
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
  showTitle?: boolean;
  /** Historia clinica: muestra SOLO las filas con clasificacion alterada (sev >= 1). */
  soloAlterados?: boolean;
  /**
   * UN NIVEL MAS AL FINAL DE LA TABLA. Hoy solo lo usa la historia clinica, para los indices ANI-BIS-E.
   *
   * ═══ POR QUE ESTO EXISTE (Santiago, 2026-09-10, y es fiel al archivo de Gildardo) ═══
   *
   * SU HC LOS PONE DENTRO DE LA TABLA DE WANG, como un nivel mas. En Atlas vivian debajo, en una tabla
   * aparte con su propia banda gris y sin padding: se veian como dos tablas apiladas que no se parecen.
   *
   * Y POR QUE NO ESTABAN YA DENTRO, que es lo que habia que verificar antes de moverlos: meterlos en el
   * MAPA de composicion los DUPLICARIA en Diagnostico, donde ya existe la tabla de indicadores en la
   * subpestaña de composicion. Por eso entran como un bloque que solo pasa la HC, y no como filas del
   * mapa: el documento clinico los muestra juntos y la pantalla de trabajo los sigue teniendo separados.
   */
  bloqueFinal?: { titulo: string; filas: FilaBloqueFinal[] } | null;
}) {
  // ═══ LA META DE PESO ES LA REFERENCIA DE LA FILA DE PESO (2026-09-10, correccion del porte) ═══
  //
  // COMO ESTA EN SU ARCHIVO (entrega VIGENTE del 4 de septiembre, linea 7721): la fila de Peso pone la
  // meta EN LA CELDA DE REFERENCIA y `difCell(peso, pesoMeta, true)` en la de Δ. **No crea una columna.**
  //
  // LA PRIMERA VERSION DE ESTO SI CREABA UNA COLUMNA, y estaba mal por tres motivos a la vez:
  //   1. Su archivo no la tiene: es la misma celda de Referencia que usan Cintura y GEB.
  //   2. En DIAGNOSTICO no existe la fila de Peso (su Nivel V ahi es IMC, cintura, NHLBI, ICC, ICT), asi
  //      que aquella columna solo podia pintar rayas en treinta filas. La meta va SOLO en Antropometria.
  //   3. Se justificaba como "simulacion sobre un valor sellado", y no lo es: la fila de Peso NO TIENE
  //      otra referencia (ni en su archivo ni en nuestro mapa, `["Peso","peso",null,"kg"]`), asi que la
  //      meta no desplaza nada sellado: ocupa una celda que estaba vacia. Es la referencia que faltaba.
  //
  // LO QUE SI HAY QUE CONSERVAR, y es lo unico: que NO SE ESCRIBA en el snapshot y que NO VIAJE al
  // documento (HC ni PDF). Se lee de `evaluations.weight_goal_kg`, que ya existe y alimenta la cadena
  // calorica; aqui solo se pinta.
  //
  // Y UN MATIZ QUE HAY QUE SABER: esta referencia es VIVA (el profesional edita la meta despues de sellar)
  // mientras las de sus vecinas son SELLADAS. Cambiar la meta mueve esta celda y ninguna otra. Es asi
  // tambien en su archivo, donde el input vive dentro de la tabla, asi que se porta igual.
  //
  // EL SIGNO ES EL SUYO: `difCell` hace `d = valor - ref`, la misma convencion que el resto de la tabla.
  // Un paciente de 80,4 con meta 75 da **+5,4**, no -5,4.
  //
  // El peso MEDIDO sale del mismo mapa que la tabla, no de una segunda fuente.
  const pesoMedido = composition.eval.flatMap((l) => l.rows).find((r) => r.key === "peso")?.value ?? null;
  const metaVigente = pesoMetaKg != null && pesoMetaKg > 0 && pesoMedido != null ? pesoMetaKg : null;
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
    // LA META DE PESO ES LA REFERENCIA DE ESTA FILA, no una columna aparte (ver el bloque de arriba). Solo
    // en la tabla de Antropometria: en Diagnostico la fila de Peso ni siquiera existe, y en la HC no entra.
    const filaDePesoConMeta = r.key === "peso" && metaVigente != null && !showDiagnosis && !soloAlterados;
    // decimalesEsp en el BORDE de render: las referenceLabel son cadenas ya armadas ("<0.45",
    // "18.5-24.9", "IMC 18.5-24.9 · CC ≤102 cm") repartidas por composition-display. Se convierte el
    // separador aqui, en el unico sitio que las pinta, en vez de editar quince literales sueltos.
    const refText = decimalesEsp(
      filaDePesoConMeta
        ? fmt(metaVigente, 1)
        : isFmi && motorRef
          ? motorRef.reference
          : w
            ? w.referenceLabel
            : (r.referenceLabel ?? fmt(effectiveRef, dec)),
    );
    // El "*" de REF_POB "en validacion" se derivo una vez en starKeys (solo referencias numericas, no bandas).
    const showStar = starKeys.has(r.key);

    // Columna Valor: casi siempre el numero; NHLBI muestra la clase, Mapa AFxIR el perfil "IR .. · AF ..".
    const valueText = w?.valueText ?? fmt(r.value, dec);

    // Columna Δ: FMI del motor; NHLBI su texto de cintura. El resto: en Diagnostico contra el corte normativo
    // (wangRowDx.cut); en Evaluacion (o filas crudas sin clasificador) contra la referencia del equipo.
    //
    // `deltaNum` existe SOLO donde la Δ es un numero que calculamos aqui, que es donde se puede colorear.
    // FMI trae la suya ya formateada del motor y NHLBI es una frase: las dos quedan sin color, igual que en
    // su archivo (su `difCell` devuelve el guion gris cuando falta cualquiera de los dos lados).
    let deltaText: string;
    let deltaNum: number | null = null;
    if (isFmi && motorRef) deltaText = motorRef.delta ?? "-";
    else if (w?.deltaText != null) deltaText = w.deltaText;
    else {
      const cut = filaDePesoConMeta ? metaVigente : w ? w.cut : effectiveRef;
      deltaNum = r.value != null && cut != null ? r.value - cut : null;
      deltaText = deltaNum == null ? "-" : `${deltaNum >= 0 ? "+" : ""}${fmt(deltaNum, dec)}`;
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
        <td className="py-1.5 pl-3 pr-4 text-foreground">
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
        {/* LA Δ VA A COLOR SOLO EN LA TABLA SIN COLUMNA DE VEREDICTO, que es la regla que sale de su
            archivo: aqui la Δ es la unica senal de direccion que hay, y en Diagnostico esa senal la lleva
            el badge (sus deltas de Diagnostico van en gris, verificado en la captura). El par es de la
            capa de INTERFAZ, no `--clinical-*`: su rojo es el hex exacto de nuestro critico, y una Δ
            direccional no es un veredicto sobre el paciente. El signo ya dice la direccion; el color la
            refuerza, no la sustituye. */}
        <td
          className={`py-1.5 pr-4 text-right tabular-nums last:pr-3 ${
            showDiagnosis ? "text-muted-foreground" : `font-semibold ${colorDeDelta(deltaNum, r.key)}`
          }`}
        >
          {deltaText}
        </td>
        {showDiagnosis ? <td className="py-1.5 pr-3">{dxNode}</td> : null}
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* PANEL, no `bloque`. Este componente nunca uso el sistema de niveles clinicos (siempre fue un
         `<section>` pelado), asi que la correccion de `bloque` del 2026-08-29 no lo alcanzo: seguia sin
         superficie sobre el gris. Lo que le faltaba no era semantica clinica, era superficie. */}
      <Panel>
        {showTitle ? (
          <h3 className="text-base font-semibold text-foreground">
            Composición corporal - Niveles de Wang
          </h3>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              {/* ═══ VARIANTE (c) DE SANTIAGO (2026-09-10) ═══

                  EL CHOQUE que reporto: el gris de la cabecera y el azul de la franja son dos familias, y
                  al ir una pegada a la otra la tabla parecia tener DOS encabezados.

                  LO QUE SE CORRIGE NO ES LA ARMONIA DE LOS DOS COLORES, ES QUE HAYA DOS RELLENOS. La
                  cabecera pierde el fondo y se queda con su linea inferior; la franja conserva el azul. Asi
                  queda UNA sola superficie pintada, y es la que dice donde empieza cada nivel de Wang, que
                  es lo unico que aqui tiene que separar.

                  Y ADEMAS LA ACERCA A SU VECINA: la tabla de indicadores ANI-BIS-E, que vive en esta misma
                  subpestaña, ya tenia la cabecera sin fondo. Eran las dos las que no se parecian. */}
              <tr className="border-b border-border text-left text-[0.8125rem] font-bold uppercase tracking-wide text-foreground">
                <th className="py-2 pl-3 pr-4 font-medium">Variable</th>
                <th className="py-2 pr-4 text-right font-medium">Valor</th>
                <th className="py-2 pr-4 text-right font-medium">Referencia</th>
                <th className="py-2 pr-4 text-right font-medium last:pr-3">Δ</th>
                {showDiagnosis ? <th className="py-2 pr-3 font-medium">Diagnóstico</th> : null}
              </tr>
            </thead>
            <tbody>
              {levelsToRender.map((lvl) => (
                <Fragment key={lvl.title}>
                  {/* ═══ LA FRANJA DE NIVEL VA EN COLOR DE MARCA (Santiago, 2026-09-10) ═══

                      LO QUE NO CAMBIA, y es la unica parte que BRAND.md protege: no lleva color de
                      RIESGO. La reserva del verde/ambar/rojo para los veredictos clinicos sigue intacta;
                      el azul de marca es capa de INTERFAZ y no insinua severidad ninguna. Textual de
                      BRAND.md sobre lo demas: "hay libertad de paleta y se usan neutros o el azul de
                      marca".

                      Y LA CABECERA DE COLUMNAS SE QUEDA GRIS, a proposito: si las dos van en color, la
                      franja deja de separar niveles y la tabla se lee como un solo bloque. El azul marca
                      donde EMPIEZA cada nivel de Wang; el gris solo rotula columnas. */}
                  <tr className="border-y border-primary/20 bg-primary/5">
                    <td
                      colSpan={colCount}
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
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
                      <td className="py-1.5 pl-3 pr-4 text-foreground">Fenotipo MCCB (FFMI×FMI)</td>
                      <td className="py-1.5 pr-4 text-right text-foreground">{fenotipoMccb.nombre}</td>
                      <td className="py-1.5 pr-4 text-right text-muted-foreground">—</td>
                      <td className="py-1.5 pr-4 text-right text-muted-foreground">—</td>
                      <td className="py-1.5 pr-3 text-foreground">{fenotipoMccb.nombre}</td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {/* EL BLOQUE FINAL, como un nivel mas (ver `bloqueFinal`). Usa las MISMAS clases que el
                  resto de la tabla, que es todo el punto: antes era otra tabla debajo, con su propia banda
                  y sin padding, y se leia como dos tablas apiladas que no se parecen. */}
              {bloqueFinal && bloqueFinal.filas.length > 0 ? (
                <Fragment key={bloqueFinal.titulo}>
                  <tr className="border-y border-primary/20 bg-primary/5">
                    <td
                      colSpan={colCount}
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {bloqueFinal.titulo}
                    </td>
                  </tr>
                  {bloqueFinal.filas.map((f) => (
                    <tr key={f.id} className="border-b border-border/40">
                      {/* Nombre arriba y sigla debajo, en la MISMA celda: otro profesional lee el nombre y
                          la columna no se ensancha. Sin nombre va la sigla sola: no se inventa uno para un
                          documento clinico. */}
                      <td className="py-1.5 pl-3 pr-4 text-foreground">
                        {/* EL MISMO RAYO que en la tabla de indices del Diagnostico, y por el mismo motivo:
                            los indices ANI salen enteros de la medicion bioelectrica. Aqui, ademas, el
                            bloque convive con filas que NO lo son, asi que el icono si distingue. Mismo
                            tamaño, color y `aria-label` que arriba: dos iconos iguales que se anuncian
                            distinto son dos cosas para quien usa lector de pantalla. */}
                        <Zap
                          className="mr-1.5 inline-block size-3.5 shrink-0 -translate-y-px text-primary"
                          aria-label="Parámetro bioeléctrico"
                        />
                        {f.sigla ? (
                          <span className="inline-flex flex-col align-middle">
                            <span className="font-medium text-foreground">{f.etiqueta}</span>
                            <span className="text-[11px] text-muted-foreground">{f.sigla}</span>
                          </span>
                        ) : (
                          <span className="font-medium text-foreground">{f.etiqueta}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-foreground">{f.valor}</td>
                      <td className="py-1.5 pr-4 text-right text-muted-foreground">{f.referencia}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {f.delta}
                      </td>
                      {showDiagnosis ? (
                        <td className="py-1.5 pr-3">
                          {/* EL MISMO SEMAFORO que el resto de la tabla (`SEV_CLS`), no un chip gris. */}
                          <DxBadge dx={{ label: f.clasificacion, sev: f.sev }} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </Fragment>
              ) : null}
              {/* Como en su HC: si NADA esta alterado se dice, en vez de dejar la tabla vacia (una tabla
                  vacia se lee como dato faltante, no como "todo en rango"). */}
              {soloAlterados &&
              levelsToRender.length === 0 &&
              (bloqueFinal?.filas.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-3 py-3 text-sm italic text-muted-foreground">
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
      </Panel>
    </div>
  );
}
