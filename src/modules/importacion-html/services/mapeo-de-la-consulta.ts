import { BIODY_COLUMNS, opcionCanonicaDelPatron } from "@/clinical-engine";
import {
  MEASURED_HIPS_HEADER,
  MEASURED_WAIST_HEADER,
  MEASURED_X50_HEADER,
  normalizeHeader,
} from "@/modules/bis/services/header-map";

import { conElTextoDeOtra, tipoDeDocumentoDeAtlas } from "./formas-del-html";

// ═══ DE UNA CONSULTA DEL HTML A LAS FILAS DE ATLAS (sesion 4, 2026-09-22) ═══
//
// PURO Y APARTE DEL ESCRITOR: lo que se guarda de cada consulta se puede probar sin base. Ningun numero se
// recalcula: se copia lo que el HTML dejo escrito, con las claves que Atlas ya usa.

export type ConsultaDelHtml = Record<string, unknown>;

/**
 * El valor de UNA respuesta del HTML en la forma que guarda Atlas, o null si no hay respuesta.
 *
 * ES UNA SOLA FUNCION A PROPOSITO: la usa el escritor (lo que se guarda) y la revision (lo que se juzga
 * antes de importar). Cuando eran dos caminos, la revision miraba una forma y el escritor guardaba otra, y
 * el error salio en produccion (ver abajo).
 *
 * ═══ EL PATRON ALIMENTARIO VIAJA COMO NUMERO (2026-09-23) ═══
 *
 * El HTML guarda las 18 preguntas de frecuencia como el INDICE de la opcion elegida (0-4), no como su texto
 * (v9 L1725: `val === i`); Atlas guarda el TEXTO. Al copiarlas tal cual llegaban como "1" o "4", que no
 * coinciden con ninguna opcion, y el dano NO fue que se viera vacio:
 *
 *   · el reader del patron las marcaba ilegibles y avisaba a Sentry, que es como se supo;
 *   · pero el ICEC SI se calculo, porque su guarda mira PRESENCIA y "1" esta presente. Con el valor en la
 *     forma equivocada, el puntaje de Alimentacion salia bajo para TODO paciente importado, en silencio,
 *     y de ahi a la edad biologica y al ICEC.
 *
 * Asi que se traduce contra el canonico del frozen. Un ordinal que no exista NO se inventa: se deja como
 * venia para que la revision lo marque como que no calza, en vez de guardar una opcion plausible y falsa.
 */
export function valorParaAtlas(clave: string, v: unknown, consulta?: ConsultaDelHtml): string | null {
  if (v == null || v === "") return null;
  // EL TEXTO LIBRE DE "OTRA" vive en un campo aparte del HTML (`<clave>_otro`) y en Atlas va dentro del
  // mismo valor ("Otra: <texto>"). Sin la consulta a mano no hay de donde sacarlo, y la opcion queda pelada.
  const conOtra = (valor: string) =>
    consulta ? conElTextoDeOtra(valor, consulta[`${clave}_otro`]) : valor;
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    return JSON.stringify(v.map((el) => (typeof el === "string" ? conOtra(el) : el)));
  }
  if (typeof v === "number") return opcionCanonicaDelPatron(clave, v) ?? String(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") return conOtra(v);
  return null;
}

/** Las respuestas de la consulta, por clave de pregunta. Las de opcion multiple viajan como JSON, igual que las de Atlas. */
export function respuestasDeLaConsulta(
  consulta: ConsultaDelHtml,
  claves: readonly string[],
): { clave: string; valor: string }[] {
  const out: { clave: string; valor: string }[] = [];
  for (const clave of claves) {
    const valor = valorParaAtlas(clave, consulta[clave], consulta);
    if (valor != null) out.push({ clave, valor });
  }
  return out;
}

const circ = (v: unknown): number => {
  const n = Number(v) || 0;
  return n > 20 ? n : 0; // `atlasCirc` del HTML: 20 cm o menos es un ratio colado, no una medida
};

/**
 * Los valores de la medicion, con el NOMBRE DE VARIABLE que Atlas persiste (el header normalizado del export
 * de Biody). Las claves del HTML son las mismas de `BIODY_COLUMNS`, porque de ahi se extrajeron.
 *
 * LAS CIRCUNFERENCIAS siguen la cadena de su `_circAnt`: la consulta, el Excel guardado y lo guardado a mano
 * (esos dos, solo para la consulta mas reciente; lo decide quien llama).
 */
export function valoresBisDeLaConsulta(
  consulta: ConsultaDelHtml,
  respaldos: { excel?: Record<string, unknown>; aMano?: Record<string, unknown> } = {},
): { variableName: string; value: number }[] {
  const out: { variableName: string; value: number }[] = [];
  for (const [campo, col] of Object.entries(BIODY_COLUMNS)) {
    const v = consulta[campo];
    if (typeof v !== "number" || !Number.isFinite(v) || v === 0) continue;
    out.push({ variableName: normalizeHeader(col.header), value: v });
  }
  // La talla puede venir como `tallaCm` (el HTML guarda las dos).
  if (!out.some((r) => r.variableName === normalizeHeader(BIODY_COLUMNS.talla.header))) {
    const talla = Number(consulta.tallaCm) || 0;
    if (talla > 0) out.push({ variableName: normalizeHeader(BIODY_COLUMNS.talla.header), value: talla });
  }
  // EL ICC Y EL ICT QUE EL HTML CALCULO (sus claves van en mayuscula). Su archivo los recalcula desde la
  // cintura, la cadera y la talla tecleadas (v9 L7154-7155), asi que el valor bueno es el suyo, no el que
  // trajera el equipo. Se guardan en las columnas que Atlas lee para esas dos filas.
  for (const [campo, clave] of [
    ["ICC", "icc"],
    ["ICT", "ict"],
  ] as const) {
    const v = Number(consulta[campo]) || 0;
    if (v > 0) out.push({ variableName: normalizeHeader(BIODY_COLUMNS[clave].header), value: v });
  }
  // LA REACTANCIA MEDIDA A 50 kHz (X50) no esta en BIODY_COLUMNS a proposito (vive aparte para no tocar la
  // entrada del motor), asi que habia que copiarla explicitamente: sin esto, la fila "Reactancia 50 kHz" de
  // la tabla de composicion sale vacia en toda medicion importada. No alimenta ningun indice; es display.
  const x50 = Number(consulta.X50) || 0;
  if (x50 > 0) out.push({ variableName: normalizeHeader(MEASURED_X50_HEADER), value: x50 });
  for (const [campo, header] of [
    ["cintura", MEASURED_WAIST_HEADER],
    ["cadera", MEASURED_HIPS_HEADER],
  ] as const) {
    const v = circ(consulta[campo]) || circ(respaldos.excel?.[campo]) || circ(respaldos.aMano?.[campo]);
    if (v) out.push({ variableName: normalizeHeader(header), value: v });
  }
  return out;
}

/**
 * ¿La consulta importada entra como inicial o como seguimiento?
 *
 * SI EL PACIENTE YA TIENE EVALUACIONES EN ATLAS, todas las importadas entran como seguimiento, aunque sean
 * anteriores: su inicial ya existe y un paciente no tiene dos (verificacion de Claude web, 2026-09-22). Si el
 * paciente es nuevo, la mas antigua es la inicial y las demas, seguimientos.
 */
export function tipoDeLaConsulta(indice: number, yaTeniaEvaluaciones: boolean): "inicial" | "seguimiento" {
  return !yaTeniaEvaluaciones && indice === 0 ? "inicial" : "seguimiento";
}

/** El instante que se guarda como fecha de la consulta: su fecha, al mediodia de Bogota (UTC-5). */
export function instanteDeLaConsulta(fecha: string): Date {
  return new Date(`${fecha.slice(0, 10)}T17:00:00.000Z`);
}

/** Nombre y apellido desde el nombre completo del HTML, que viene en un solo campo. */
export function partirNombre(nombre: string): { firstName: string; lastName: string } {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { firstName: "Sin nombre", lastName: "" };
  if (partes.length === 1) return { firstName: partes[0], lastName: "" };
  // Dos nombres y dos apellidos es lo comun en Colombia: la mitad para cada lado, con el sobrante al nombre.
  const corte = Math.ceil(partes.length / 2);
  return { firstName: partes.slice(0, corte).join(" "), lastName: partes.slice(corte).join(" ") };
}

const TIPOS = ["CC", "CE", "TI", "PA", "NIT"] as const;
export type TipoDocumento = (typeof TIPOS)[number];

/**
 * El tipo de documento del HTML, si es uno de los que Atlas admite. Por defecto, CC.
 *
 * TRADUCE LA ETIQUETA COMPLETA desde el 2026-09-23 (`tipoDeDocumentoDeAtlas`): el HTML guarda
 * "Cédula de ciudadanía" y antes eso no calzaba con ningun codigo, asi que TODO entraba como CC. En la
 * muestra real acertaba por casualidad; un pasaporte habria entrado como cedula con el mismo numero, y la
 * llave del paciente es (organizacion, tipo, numero): el dia que alguien lo creara bien, quedaba duplicado.
 */
export function tipoDeDocumento(valor: unknown): TipoDocumento {
  const traducido = tipoDeDocumentoDeAtlas(valor);
  if (traducido) return traducido;
  const v = typeof valor === "string" ? valor.trim().toUpperCase() : "";
  return (TIPOS as readonly string[]).includes(v) ? (v as TipoDocumento) : "CC";
}
