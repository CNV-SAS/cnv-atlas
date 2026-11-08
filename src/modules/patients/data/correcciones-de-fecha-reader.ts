import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { correccionesDeFechaDeNacimiento } from "@/db/schema";
import type { CorreccionDeFecha } from "@/modules/clinical-pipeline/fecha-corregida-despues-de-emitir";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CORRECCIONES DE FECHA DE NACIMIENTO  ·  LECTURA (0244, regla dura 1)
//
// ═══ QUE SALE DE AQUI, Y QUE NO ═══
//
// Las dos funciones devuelven SOLO el `created_at` de cada correccion, no el par de fechas. Quien las
// llama (la pantalla de recalibracion y el guard de la reemision) necesita contestar *"¿se corrigio
// despues de emitir?"*, y para eso basta el cuando. El par (anterior, nueva) son dos fechas de
// nacimiento de una persona, o sea PII, y la pantalla de recalibracion es una operacion sobre el
// historico sin datos de paciente: sacarlo de aqui lo pondria al alcance de algo que no lo pidio.
//
// ═══ POR QUE DRIZZLE Y NO EL CLIENTE DE SUPABASE ═══
//
// Dos razones, y la segunda es la que manda. La tabla es de la migracion 0244 y los tipos generados de
// Supabase (`database.generated.ts`) todavia no la tienen, asi que un `.from(...)` no compilaria. Y la
// politica RLS de la tabla es SOLO ADMIN, deliberadamente (lleva dos fechas de nacimiento de la misma
// persona): leerla por el cliente con RLS haria que el guard de la reemision se comportara distinto
// segun quien lo invoque, y un guard que acepta para el admin y rechaza para el profesional, sin decir
// por que, es peor que uno estricto. Lo que sale de aqui no es PII, asi que la lectura no necesita la
// policy para proteger nada.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Las correcciones de UN paciente, la mas reciente primero. Vacio si nunca se le corrigio la fecha. */
export async function correccionesDeFechaDeUnPaciente(
  patientId: string,
): Promise<CorreccionDeFecha[]> {
  const filas = await db
    .select({ creadaEn: correccionesDeFechaDeNacimiento.createdAt })
    .from(correccionesDeFechaDeNacimiento)
    .where(eq(correccionesDeFechaDeNacimiento.patientId, patientId))
    .orderBy(desc(correccionesDeFechaDeNacimiento.createdAt));
  return filas.map((f) => ({ creadaEn: f.creadaEn.toISOString() }));
}

/**
 * Las correcciones de VARIOS pacientes, agrupadas por paciente.
 *
 * EN UNA SOLA IDA A LA BASE, como las huellas repetidas y por el mismo motivo: la pantalla de
 * recalibracion lista cientos de filas y una consulta por fila la volveria inusable.
 *
 * Y CON LA LISTA DE PACIENTES, no la tabla entera: es append-only y va a crecer, y filtrar aqui deja el
 * trabajo proporcional a lo que la pantalla muestra. La lista va troceada porque un `in` muy largo ya
 * mordio en este proyecto (el "URI too long" de PostgREST); aqui va por SQL y no por URL, pero el tope
 * de parametros existe igual.
 */
export async function correccionesDeFechaPorPaciente(
  patientIds: string[],
): Promise<Map<string, CorreccionDeFecha[]>> {
  const porPaciente = new Map<string, CorreccionDeFecha[]>();
  const unicos = [...new Set(patientIds.filter((id) => id))];
  const TROZO = 500;
  for (let i = 0; i < unicos.length; i += TROZO) {
    const trozo = unicos.slice(i, i + TROZO);
    if (trozo.length === 0) continue;
    const filas = await db
      .select({
        patientId: correccionesDeFechaDeNacimiento.patientId,
        creadaEn: correccionesDeFechaDeNacimiento.createdAt,
      })
      .from(correccionesDeFechaDeNacimiento)
      .where(inArray(correccionesDeFechaDeNacimiento.patientId, trozo));
    for (const f of filas) {
      const ya = porPaciente.get(f.patientId) ?? [];
      ya.push({ creadaEn: f.creadaEn.toISOString() });
      porPaciente.set(f.patientId, ya);
    }
  }
  return porPaciente;
}
