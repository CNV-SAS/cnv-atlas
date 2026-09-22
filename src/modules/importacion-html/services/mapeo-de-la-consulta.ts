import { BIODY_COLUMNS } from "@/clinical-engine";
import { MEASURED_HIPS_HEADER, MEASURED_WAIST_HEADER, normalizeHeader } from "@/modules/bis/services/header-map";

// ═══ DE UNA CONSULTA DEL HTML A LAS FILAS DE ATLAS (sesion 4, 2026-09-22) ═══
//
// PURO Y APARTE DEL ESCRITOR: lo que se guarda de cada consulta se puede probar sin base. Ningun numero se
// recalcula: se copia lo que el HTML dejo escrito, con las claves que Atlas ya usa.

export type ConsultaDelHtml = Record<string, unknown>;

/** Las respuestas de la consulta, por clave de pregunta. Las de opcion multiple viajan como JSON, igual que las de Atlas. */
export function respuestasDeLaConsulta(
  consulta: ConsultaDelHtml,
  claves: readonly string[],
): { clave: string; valor: string }[] {
  const out: { clave: string; valor: string }[] = [];
  for (const clave of claves) {
    const v = consulta[clave];
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      out.push({ clave, valor: JSON.stringify(v) });
    } else if (typeof v === "number" || typeof v === "boolean") {
      out.push({ clave, valor: String(v) });
    } else if (typeof v === "string") {
      out.push({ clave, valor: v });
    }
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

/** El tipo de documento del HTML, si es uno de los que Atlas admite. Por defecto, CC. */
export function tipoDeDocumento(valor: unknown): TipoDocumento {
  const v = typeof valor === "string" ? valor.trim().toUpperCase() : "";
  return (TIPOS as readonly string[]).includes(v) ? (v as TipoDocumento) : "CC";
}
