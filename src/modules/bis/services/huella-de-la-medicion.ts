import { BIODY_COLUMNS } from "@/clinical-engine";

import { normalizeHeader } from "./header-map";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA HUELLA DE UNA MEDICION  ·  PARA SABER SI ESTA MISMA TOMA YA ESTA EN LA BASE
//
// ═══ DE DONDE SALE, Y NO ES UNA SOSPECHA ═══
//
// Medido en produccion el 2026-10-24, al verificar los errores 1 y 2 de la especificacion EB-BIS v7 de
// Gildardo: 15 grupos de mediciones con los cuatro crudos del equipo identicos hasta el ultimo decimal.
// Separando los pacientes de prueba y la copia legitima del flujo de correccion quedan **10 grupos reales:
// 4 entre pacientes DISTINTOS y 6 dentro del mismo paciente**, 20 evaluaciones, todas de una profesional.
// Es exactamente la lista que Gildardo reporto. O sea: hay historias clinicas con la bioimpedancia de otra
// persona, y de ahi salio el diagnostico que esa otra persona recibio.
//
// UN SOLO MECANISMO, y sigue abierto sin esto: el MISMO archivo importado dos veces, o importado al
// paciente equivocado, desde la pantalla de importar. Dos grupos se crearon con dos y cuatro minutos de
// diferencia. (El lote del HTML NO fue: solo 2 de las 406 mediciones de la base llevan un lote. Las 13
// evaluaciones con lote de esta lista vinieron del HTML SIN medicion, y su XLSX se importo despues.)
//
// ═══ POR QUE NO SIRVE UN FRENO SOBRE LA RELACION ═══
//
// `bis_measurements.evaluation_id` ya es una sola columna, asi que "una medicion no puede estar en dos
// evaluaciones" YA se cumple y no evita nada: lo que pasa es que se CREA otra fila con los mismos numeros.
// El freno tiene que mirar el CONTENIDO, y eso es lo que hace esta huella.
//
// ═══ QUE ENTRA EN LA HUELLA, Y SU FUENTE ═══
//
// Las CUATRO lecturas electricas del equipo: Re, Ri, Rinf y C. Su fuente es `BIODY_COLUMNS`, donde son las
// unicas resistencias marcadas `required: true` porque son los insumos del motor. Son lecturas directas del
// equipo con cuatro o mas cifras significativas, asi que dos personas distintas coincidiendo en las cuatro
// a la vez no es improbable: es imposible en la practica. En los 11 grupos medidos coincidian las cuatro.
//
// NO ENTRA LA FECHA, y es deliberado: en los grupos reales la fecha de la medicion a veces coincidia y a
// veces no (un grupo con cinco minutos de diferencia en la creacion), asi que filtrar por fecha habria
// dejado pasar justo los casos que importan. Y NO ENTRAN peso ni talla: al ser menos precisos no anaden
// certeza, y si alguna via los redondeara distinto convertirian un duplicado real en invisible.
//
// ESTO ES UN CRITERIO QUE DECIDE SOBRE UN DATO CLINICO, asi que se escribe con su fuente al lado (regla de
// Santiago, 2026-10-02) y se elige por el lado de lo IMPOSIBLE: antes dejar pasar un duplicado que frenar
// una medicion real de una persona que esta en la silla.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Los campos del Biody que identifican la toma fisica. Su nombre sale de BIODY_COLUMNS, no de una copia. */
export const CAMPOS_DE_LA_HUELLA = ["Re", "Ri", "Rinf", "C"] as const;

/** Los `variable_name` tal como quedan guardados en `bis_raw_values` (encabezado normalizado). */
export const VARIABLES_DE_LA_HUELLA: string[] = CAMPOS_DE_LA_HUELLA.map((campo) =>
  normalizeHeader(BIODY_COLUMNS[campo].header),
);

export type ValorCrudo = { variableName: string; value: number | string };

/**
 * La huella de una medicion, o `null` si le falta alguna de las cuatro lecturas.
 *
 * `null` NO significa "no hay duplicado": significa "no se puede comparar". Quien llama tiene que dejar
 * pasar en ese caso, porque frenar por no poder comparar seria frenar lo que no se sabe. Una medicion sin
 * esas cuatro lecturas ya la rechaza el motor por otro lado (`INSUMOS_MOTOR_AUSENTES`).
 */
export function huellaDeLaMedicion(valores: readonly ValorCrudo[]): string | null {
  const porNombre = new Map<string, number>();
  for (const v of valores) {
    // NUMERICO, NO TEXTO: la base devuelve `numeric` como cadena, y "2.04" y "2.040" son el mismo valor.
    // Comparar las cadenas dejaria pasar el duplicado por un cero de mas.
    const n = typeof v.value === "number" ? v.value : Number(v.value);
    if (Number.isFinite(n)) porNombre.set(v.variableName, n);
  }
  const partes: string[] = [];
  for (const nombre of VARIABLES_DE_LA_HUELLA) {
    const n = porNombre.get(nombre);
    if (n === undefined) return null;
    partes.push(String(n));
  }
  return partes.join("|");
}

/** El valor de la primera variable de la huella: sirve para buscar candidatos por indice antes de comparar. */
export function valorParaBuscarCandidatos(valores: readonly ValorCrudo[]): number | null {
  const v = valores.find((x) => x.variableName === VARIABLES_DE_LA_HUELLA[0]);
  if (!v) return null;
  const n = typeof v.value === "number" ? v.value : Number(v.value);
  return Number.isFinite(n) ? n : null;
}
