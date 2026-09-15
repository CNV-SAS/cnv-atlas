// ═══ LA CAUSA DE UN ERROR, PARA SENTRY (2026-09-15) ═══
//
// EL PROBLEMA: Drizzle envuelve todo fallo de consulta en un "Failed query: <sql> params: <...>" y guarda el error
// real en `.cause`. En el smoke del Bloque A, Sentry mostro solo la consulta: si fue la conexion, un timeout del
// pooler o un error de SQL, no se supo. Un fallo de la base llegaba mudo. Es la familia del catch que guardaba
// solo `.message`.
//
// LO QUE SE MANDA: la cadena de causas con lo ESTRUCTURAL, que identifica el fallo sin llevar datos:
//   · de Postgres: el SQLSTATE (`23505`, `57014`...), la rutina, y los nombres de restriccion, tabla y columna.
//     NUNCA su `detail` ni su mensaje: "Key (document)=(123...) already exists" o "invalid input syntax: ..."
//     traen el valor de la fila, y puede ser el documento de un paciente.
//   · de la conexion (postgres.js, red): el codigo (`CONNECTION_CLOSED`, `ECONNRESET`, `ETIMEDOUT`) y su mensaje,
//     que es "write CONNECTION_CLOSED host:puerto" y no trae datos.
// Modulo puro: se prueba sin Sentry.

import { redactarTextoDeError } from "./scrub";

export type EslabonDeCausa = {
  tipo: string;
  codigo?: string;
  rutina?: string;
  restriccion?: string;
  tabla?: string;
  columna?: string;
  mensaje?: string;
};

const MAX_ESLABONES = 5;

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v.slice(0, 200) : undefined;
}

/** Postgres respondio con un error de SQL: trae `severity` y un SQLSTATE de cinco caracteres. */
function esErrorDePostgres(e: Record<string, unknown>): boolean {
  return typeof e.severity === "string" && typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code);
}

/** El envoltorio de Drizzle: su mensaje lleva la consulta y los PARAMETROS, que pueden ser datos de pacientes. */
function esEnvoltorioDeConsulta(e: Record<string, unknown>): boolean {
  return "query" in e && "params" in e;
}

export function cadenaDeCausas(error: unknown): EslabonDeCausa[] {
  const cadena: EslabonDeCausa[] = [];
  let actual: unknown = error;
  const vistos = new Set<unknown>();
  while (actual instanceof Error && cadena.length < MAX_ESLABONES && !vistos.has(actual)) {
    vistos.add(actual);
    const e = actual as unknown as Record<string, unknown>;
    const eslabon: EslabonDeCausa = { tipo: actual.constructor?.name || actual.name || "Error" };
    if (esErrorDePostgres(e)) {
      eslabon.codigo = texto(e.code);
      eslabon.rutina = texto(e.routine);
      eslabon.restriccion = texto(e.constraint_name);
      eslabon.tabla = texto(e.table_name);
      eslabon.columna = texto(e.column_name);
    } else if (esEnvoltorioDeConsulta(e)) {
      eslabon.tipo = "DrizzleQueryError";
    } else {
      eslabon.codigo = texto(e.code);
      const m = texto(actual.message);
      eslabon.mensaje = m ? redactarTextoDeError(m) : undefined;
    }
    cadena.push(eslabon);
    actual = (actual as { cause?: unknown }).cause;
  }
  return cadena;
}
