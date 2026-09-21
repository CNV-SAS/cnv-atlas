// ═══ LAS RESTRICCIONES QUE EL PACIENTE DECLARO, PRECARGADAS EN EL CAMPO DEL PROFESIONAL (2026-09-21) ═══
//
// LA DECISION ES DE GILDARDO, via Santiago: si en la encuesta el paciente marco algo en patron alimentario
// (P34), alergias (P43) o intolerancias (P44) que no sea "Ninguna", eso va a "Restricciones alimentarias". Y
// si marco "Otra" y escribio a que se referia, va lo que escribio.
//
// SE PRECARGA, NO SE IMPONE. Entra en el campo del PROFESIONAL (`treatments.restricciones`), lleno de
// entrada, y desde ahi es suyo: lo edita, lo borra si en consulta el paciente cambio de opinion, y lo que
// quede es exactamente lo que va a la IA del menu. Por eso no choca con lo del 27 de agosto ni con lo del
// 11 de septiembre: no es un filtro del software ni una confirmacion que haya que registrar, es su campo.
//
// SIN TRADUCIR, y es la mitad que no se negocia. "Mariscos" sale como "Mariscos", no como "camaron,
// langostino, calamar": traducir un alergeno a alimentos es contenido clinico que su archivo no tiene
// (27-ago §10). Lo unico que se antepone es DE QUE PREGUNTA vino ("Alergia alimentaria: Mariscos"), que no
// interpreta nada: sin eso, "Mariscos" suelto en una lista de restricciones no dice si es alergia,
// intolerancia o gusto, y la IA y el profesional lo leerian distinto.
//
// SE LLAMA UNA SOLA VEZ, al crear el tratamiento (pipeline-writer). No hay ninguna lectura posterior que
// vuelva a llenar el campo: lo que el profesional borra, queda borrado.
//
// PURO: sin BD ni cliente.

/** Las tres preguntas, con el rotulo que se antepone. El orden es el de la encuesta. */
export const PREGUNTAS_DE_RESTRICCION: { fieldKey: string; rotulo: string }[] = [
  { fieldKey: "d4_34", rotulo: "Patrón alimentario" },
  { fieldKey: "d6_43", rotulo: "Alergia alimentaria" },
  { fieldKey: "d6_44", rotulo: "Intolerancia alimentaria" },
];

const NINGUNA = /^ningun[oa]$/i;
// "Otra" / "Otras" / "Otro" / "Otros", con o sin el texto libre detras de los dos puntos.
const OTRA = /^otr[oa]s?\s*(?::\s*(.*))?$/i;

/** Decodifica el valor guardado: multi-opcion como JSON, opcion simple como texto plano. */
function elementos(valor: string): string[] {
  try {
    const p: unknown = JSON.parse(valor);
    return Array.isArray(p) ? p.map((x) => String(x)) : [valor];
  } catch {
    return [valor];
  }
}

/**
 * Lo que el paciente declaro en las tres preguntas, listo para el campo de restricciones.
 *
 * - "Ninguna" / "Ninguno" no entra.
 * - "Otra" sin texto no entra (no dice nada que el profesional pueda usar).
 * - "Otra: frutos rojos" entra como lo que escribio: "Alergia alimentaria: frutos rojos".
 * - Sin duplicados: si la misma linea sale dos veces, queda una.
 */
export function restriccionesDeLaEncuesta(
  respuestas: { fieldKey: string | null | undefined; valor: string | null | undefined }[],
): string[] {
  const out: string[] = [];
  for (const { fieldKey, rotulo } of PREGUNTAS_DE_RESTRICCION) {
    for (const r of respuestas) {
      if (r.fieldKey !== fieldKey) continue;
      if (typeof r.valor !== "string" || r.valor.trim() === "") continue;
      for (const bruto of elementos(r.valor)) {
        const el = bruto.trim();
        if (el === "" || NINGUNA.test(el)) continue;
        const otra = OTRA.exec(el);
        const texto = otra ? (otra[1] ?? "").trim() : el;
        if (texto === "") continue;
        const linea = `${rotulo}: ${texto}`;
        if (!out.includes(linea)) out.push(linea);
      }
    }
  }
  return out;
}
