import { allCompositionRows, type Composition } from "./composition-map";
import { computeRefPob, type RefPobEntry } from "./composition-display";
import { wangRowDx } from "./composition-display";

// LA COMPOSICION CORPORAL YA CLASIFICADA, para que la pantalla y el PDF pidan lo mismo.
//
// POR QUE EXISTE. El veredicto de cada fila ("Optimo", "Riesgo") lo produce `wangRowDx`, que necesita un
// contexto que hasta ahora armaba SOLO el componente de pantalla: las referencias poblacionales
// (`computeRefPob`), el IMC, la cintura, el angulo de fase y el indice de reactancia. Mientras ese contexto
// vivio dentro del componente, el PDF no podia clasificar sin RECONSTRUIRLO, que habria sido una segunda
// construccion del clasificador: si divergiera, la historia impresa y la enviada clasificarian distinto al
// mismo paciente.
//
// Con esto, la resolucion del contexto vive UNA VEZ y los dos consumidores piden la fila ya clasificada.
// No cambia ningun corte ni ninguna etiqueta: mueve de sitio quien arma el contexto.

export type FilaClasificada = {
  key: string;
  etiqueta: string;
  /** Valor formateado con sus unidades, listo para imprimir. */
  valor: string;
  /** La referencia contra la que se compara, tal como la muestra la pantalla. */
  referencia: string | null;
  /** El veredicto de la fila. null = la fila no tiene clasificador (es un dato crudo). */
  clasificacion: string | null;
  /** Severidad para la capa de color clinica. null cuando no hay veredicto. */
  severidad: number | null;
};

const fmt = (v: number | null, decimals = 2): string =>
  v == null ? "" : v.toFixed(decimals).replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));

/**
 * Todas las filas de composicion con su valor, su referencia y su veredicto.
 *
 * `sexoM` decide varios cortes; sin composicion devuelve una lista vacia, que aguas arriba se dice como
 * "esta evaluacion no tiene medicion", no como un bloque mudo.
 */
export function composicionClasificada(
  composition: Composition | null,
  sexoM: boolean,
): FilaClasificada[] {
  if (!composition) return [];

  const refMap: Record<string, number | null> = {};
  const valueMap: Record<string, number | null> = {};
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

  // REF_POB: rellena los `*_ref` que el equipo NO trajo, para que la referencia (y con ella el veredicto)
  // no queden vacios. Misma llamada que hace la pantalla.
  const refPob: Record<string, RefPobEntry> = computeRefPob(
    composition.peso,
    composition.talla,
    sexoM,
    (k) => refMap[k] ?? null,
  );

  return allCompositionRows(composition)
    .filter((r) => r.value != null)
    .map((r) => {
      const rpe = r.reference == null && r.refKey ? refPob[r.refKey] : undefined;
      const effRef = r.reference ?? rpe?.value ?? null;
      const w = wangRowDx(r.key, r.value, sexoM, diagCtx, effRef, (v) => fmt(v, r.decimals ?? 2));
      return {
        key: r.key,
        etiqueta: r.label,
        valor: `${fmt(r.value, r.decimals ?? 2)} ${r.unit}`.trim(),
        referencia: w?.referenceLabel ?? (effRef != null ? fmt(effRef, r.decimals ?? 2) : null),
        clasificacion: w?.dx?.label ?? null,
        severidad: w?.dx?.sev ?? null,
      };
    });
}
