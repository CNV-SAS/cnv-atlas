// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UNA RESPUESTA GUARDADA, LEIDA  ·  LA UNICA INTERPRETACION  ·  2026-11-09
//
// ═══ POR QUE EXISTE ESTE MODULO ═══
//
// Una respuesta se guarda en una sola columna de texto, y su forma depende del tipo de la pregunta: una
// opcion unica es el texto de la opcion, una multiple es un arreglo JSON de textos, y el S1 y el S2 de la
// CNV-S son un objeto JSON {idDelProducto: opcion}. Leerla es, entonces, una decision, y estaba tomada en
// CUATRO sitios a la vez: los widgets, la redaccion del SOAP, el CSV y el mapa de antecedentes de la HC.
//
// LO QUE COSTO ESO, medido en el smoke del 9 de noviembre: en la encuesta el paciente leia *"La vez
// pasada respondiste: [\"Ninguno\"]"* y en la vista del profesional el Modulo S salia como
// `{"7777...702":"Lo suspendió"}`. Dos superficies distintas ensenando la estructura de la base a una
// persona, cada una por su cuenta, y ninguna de las dos "mal": simplemente nadie habia decidido una vez
// como se lee este dato.
//
// ═══ MODULO NEUTRO, Y ESO ES LO QUE LO HACE POSIBLE ═══
//
// Sin `server-only` ni `"use client"`: lo importan los widgets (cliente), el SOAP y el CSV (servidor) y
// los tests. La version anterior de esta funcion vivia DENTRO de `survey-widgets`, que es un modulo
// cliente, asi que un lector de servidor no podia reusarla sin cruzar la frontera RSC (hazard B).
//
// ═══ NO INTERPRETA NADA CLINICO ═══
//
// No decide si una respuesta cuenta como respondida (eso es `isAnswered`), ni si es adherencia (eso es
// `modulo-s`). Solo dice QUE texto tiene delante quien lo lea.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los valores de una respuesta: los textos elegidos de una multiple, o el texto suelto.
 *
 * ═══ Y DESENVUELVE EL ARREGLO DENTRO DEL ARREGLO (defecto del smoke, 2026-11-09) ═══
 *
 * El bloque de confirmacion de la CNV-S emitia la respuesta anterior TAL CUAL en un solo campo, y el
 * servidor, que envuelve en un arreglo todo lo que llega de una multiple, la guardaba como
 * `["[\"Ninguna\"]"]`: un arreglo cuyo unico texto es, el mismo, un arreglo. Eso no casa con ninguna
 * opcion del catalogo, asi que las pantallas mostraban SIN RESPONDER una pregunta que el paciente si
 * confirmo, y en `d5_39` (que alimenta el diagnostico) el motor no habria reconocido ningun diagnostico
 * personal.
 *
 * LA EMISION YA ESTA ARREGLADA (`cnvs-widgets` manda un campo por opcion). Esto es lo que hace legibles
 * las filas que YA se escribieron asi, y no adivina: ningun texto de opcion de la encuesta es un arreglo
 * JSON, asi que un valor con esa forma solo puede venir de ese defecto, y desenvolverlo devuelve
 * exactamente lo que el paciente marco.
 */
export function valoresDeLaRespuesta(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  // DEFENSA EN RUNTIME, no en el tipo: la columna es `text`, asi que esto es siempre un texto o null.
  // Pero esta funcion la llaman cuatro superficies, una de ellas la exportacion de una consulta, y un
  // valor inesperado (un numero, un arreglo ya parseado por otra capa) no puede tumbar la pantalla: se
  // lee como se pueda antes que perderlo.
  const valor: unknown = raw;
  if (Array.isArray(valor)) return valor.flatMap(desenvolver);
  const s = typeof valor === "string" ? valor.trim() : String(valor).trim();
  if (s === "" || s === "[]") return [];
  if (!s.startsWith("[")) return [s];
  try {
    const arr: unknown = JSON.parse(s);
    if (!Array.isArray(arr)) return [s];
    return arr.flatMap(desenvolver);
  } catch {
    return [s]; // no parseable: se muestra crudo antes que perderlo
  }
}

/** Un elemento del arreglo guardado: si el mismo es un arreglo JSON, sus textos; si no, el texto. */
function desenvolver(v: unknown): string[] {
  if (typeof v !== "string") return v == null ? [] : [String(v)];
  const t = v.trim();
  if (t === "") return [];
  if (!t.startsWith("[")) return [v];
  try {
    const dentro: unknown = JSON.parse(t);
    if (!Array.isArray(dentro)) return [v];
    return dentro.map(String).filter((x) => x.trim() !== "");
  } catch {
    return [v];
  }
}

/**
 * El objeto guardado del S1 y del S2: una opcion POR PRODUCTO. `{}` si no hay o no tiene esa forma.
 *
 * Su §2.3 presenta el S1 *"una vez por cada nutracéutico"*, y una pregunta de Atlas guarda UNA respuesta
 * por (encuesta, pregunta): de ahi el objeto. La clave es el id del producto, que es lo correcto a la
 * hora de guardar (un nombre comercial cambia) y lo que obliga a esta funcion a la hora de leer.
 */
export function parsePorProducto(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const salida: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string" && val.trim() !== "") salida[k] = val;
    }
    return salida;
  } catch {
    // Una respuesta guardada que no es JSON no es un error del paciente: se arranca en blanco.
    return {};
  }
}

/** El nombre comercial de cada producto, por id. Lo resuelve el lector; aqui solo se usa. */
export type NombresDeProductos = Record<string, string>;

/**
 * El S1 o el S2 en palabras: *"MULTI-CELL BASE: Lo suspendió · OMEGA COMPLEX: Todos los días"*.
 *
 * SIN EL NOMBRE NO SE ESCRIBE EL ID. Un identificador en una pantalla clinica no es informacion: es
 * ruido que ademas parece un error del sistema. Si el producto no se puede nombrar se dice eso, que es
 * lo unico cierto, y la respuesta no se pierde.
 */
export function textoPorProducto(
  raw: string | null | undefined,
  nombres: NombresDeProductos = {},
  separador = " · ",
): string {
  const porProducto = parsePorProducto(raw);
  const partes = Object.entries(porProducto).map(
    ([id, valor]) => `${nombres[id] ?? "Producto no identificado"}: ${valor}`,
  );
  return partes.join(separador);
}

/** El tipo de pregunta, para saber como leer su valor. Los demas tipos se leen tal cual. */
export type TipoDePregunta = string | null | undefined;

/**
 * La respuesta en texto corriente, para cualquier superficie que la escriba como texto (el SOAP, el CSV,
 * la historia clinica). Las pantallas con pastillas usan los valores (`valoresDeLaRespuesta`) y los
 * pintan; esto es para donde no hay pastillas, solo una linea.
 */
export function textoDeLaRespuesta(
  raw: string | null | undefined,
  opciones: { tipo?: TipoDePregunta; nombres?: NombresDeProductos; separador?: string } = {},
): string {
  const separador = opciones.separador ?? ", ";
  if (raw == null) return "";
  if (opciones.tipo === "opcion_por_producto") {
    return textoPorProducto(raw, opciones.nombres, separador === ", " ? " · " : separador);
  }
  const valores = valoresDeLaRespuesta(raw);
  if (valores.length === 0) return "";
  return valores.map((v) => v.trim()).filter(Boolean).join(separador);
}
