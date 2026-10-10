import "server-only";

import { and, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { patientProfiles } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// COMPLETAR EL SEXO DE UN PACIENTE AL QUE LE FALTA.
//
// ── POR QUE HACE FALTA UN ESCRITOR PARA ESTO (Sentry, 2026-10-10) ──────────────────────────────────
//
// Porque habia pacientes sin sexo y NINGUN camino para ponerlo. El intake lo exige estricto
// (`z.enum(["F","M"])`), pero el import del HTML lo mapea desde la palabra que trae el archivo y devuelve
// null cuando no la reconoce, y el seguimiento no vuelve a tocar el perfil. Resultado: una paciente sin
// sexo, su diagnostico imposible, y el unico remedio era un script contra la base.
//
// ── RELLENA UN HUECO, NUNCA PISA UN VALOR, Y ESO LO IMPONE EL `where` ──────────────────────────────
//
// El `update` lleva en su propia condicion que el sexo este VACIO. No es una comprobacion previa que luego
// se escribe: entre leer y escribir cabe otra escritura, y esta es justo la clase de dato donde eso no
// puede pasar. Si ya habia un sexo, no se actualiza ninguna fila y la funcion devuelve `false`.
//
// Y LA RAZON DE FONDO no es prudencia: cambiar el sexo de un paciente con diagnostico SELLADO invalidaria
// el sellado, y un sellado no se recalcula (ver `normalize-patient-sex.mjs`). Esa es otra decision, con su
// propio bloque; esto solo cierra el hueco de que falte.
//
// ── Y QUEDA EN EL RASTRO CLINICO, inline en la transaccion (regla dura 8) ──────────────────────────
//
// El sexo decide TODAS las clasificaciones del motor, asi que quien lo registro y cuando es parte de la
// historia del diagnostico, no un detalle administrativo.
export type SexoDelPaciente = { patientId: string; sex: "F" | "M" };

export type ActorDelSexo = {
  actorId: string;
  actorEmail: string | null;
  ip?: string | null;
};

/** `true` si lo escribio; `false` si el paciente ya tenia un sexo registrado y no se toco nada. */
export async function completarSexoDelPaciente(
  { patientId, sex }: SexoDelPaciente,
  actor: ActorDelSexo,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [escrito] = await tx
      .update(patientProfiles)
      .set({ sex })
      .where(
        and(
          eq(patientProfiles.patientId, patientId),
          // VACIO ES null O CADENA EN BLANCO. Las dos existen en la base: el import del HTML dejo nulls, y
          // el intake viejo de texto libre pudo dejar blancos. Mirar solo `isNull` dejaria al segundo sin
          // arreglo posible y la pantalla diria "guardado" sin haber guardado nada.
          or(sql`${patientProfiles.sex} is null`, sql`btrim(${patientProfiles.sex}) = ''`),
        ),
      )
      .returning({ patientId: patientProfiles.patientId });
    if (!escrito) return false;

    await recordAudit(tx, {
      event: "patient.sexo_completado",
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      entityType: "patient",
      entityId: patientId,
      // El valor SI va al rastro: es el insumo que decide las clasificaciones, no un dato de contacto.
      payload: { sexo: sex, estaba: "vacio" },
      ip: actor.ip ?? null,
    });
    return true;
  });
}

// ═══ Y CORREGIR UN SEXO YA REGISTRADO (Santiago, 2026-10-10) ═══
//
// ── POR QUE SE ABRE ESTA PUERTA, QUE EL BLOQUE DE ARRIBA DECIA NO ABRIR ───────────────────────────
//
// Porque el bloque de arriba resolvia un hueco y dejaba un callejon al lado. Textual de Santiago:
// *"un paciente por ejemplo transexual puede pensar que es el genero, entonces el profesional debe poder
// cambiarlo."* El motor usa el sexo BIOLOGICO, asi que un genero anotado ahi no es un detalle de papeleria:
// es un insumo clinico equivocado que produce clasificaciones equivocadas, y hasta hoy no tenia arreglo.
//
// Es el mismo defecto que ya nos costo dos veces: un freno correcto SIN SALIDA se vive como un sistema
// roto. La frontera no era proteger el dato, era que nadie lo pisara EN SILENCIO.
//
// ── LO QUE NO HACE, Y ES LA PARTE QUE IMPORTA ─────────────────────────────────────────────────────
//
// NO rehace ningun diagnostico. Un diagnostico generado es el registro de lo que se concluyo con los datos
// de entonces, y reescribirlo por detras seria cambiar una conclusion clinica sin que nadie la decida.
// Lo que si pasa: el motor LEE el sexo del perfil en cada corrida (`readPipelineInputs`), asi que el
// siguiente diagnostico, y cualquier evaluacion rehecha por el camino de correccion, salen con el nuevo.
//
// Quien tenga que rehacer una evaluacion ya diagnosticada usa ese camino (`correctEvaluation`), que crea una
// VERSION NUEVA, recalcula y marca la vieja como reemplazada con su motivo. Existe desde antes y es el unico
// sitio donde una conclusion clinica se sustituye, dicho.
//
// ── LA FRONTERA AQUI ES EL CANDADO DE FILA, no el `where` ─────────────────────────────────────────
//
// El de arriba se defiende con su propia condicion (`sex is null`), porque le basta con no pisar. Este
// TIENE que pisar, y ademas tiene que contar DE QUE valor a cual, asi que lee y escribe: por eso lee con
// `for update`, que bloquea la fila hasta el final de la transaccion. Sin ese candado, entre leer y
// escribir cabe otra correccion y el rastro afirmaria que se partio de un valor que ya no era el que habia.

export type CorreccionDeSexo = { patientId: string; sex: "F" | "M"; motivo: string };

export type ResultadoDeLaCorreccion =
  | { estado: "corregido"; sexoAnterior: string | null }
  /** El paciente ya tenia ese mismo sexo (o no existe): no se toco nada y no hay rastro que escribir. */
  | { estado: "sin-cambio" };

export async function corregirSexoDelPaciente(
  { patientId, sex, motivo }: CorreccionDeSexo,
  actor: ActorDelSexo,
): Promise<ResultadoDeLaCorreccion> {
  return db.transaction(async (tx) => {
    // ── EL VALOR VIEJO SE LEE CON LA FILA BLOQUEADA, no antes de la transaccion ──
    //
    // `for update` es lo que hace segura esta lectura-y-escritura: cualquier otra transaccion que quiera
    // tocar esta fila espera hasta que esta termine. Sin el candado, entre leer y escribir cabe otra
    // correccion y el rastro diria que se paso de un valor que ya no era el que habia.
    //
    // (El `returning old.sex` de una sola sentencia, que seria mas corto, es de Postgres 18.)
    const [antes] = await tx
      .select({ sex: patientProfiles.sex })
      .from(patientProfiles)
      .where(eq(patientProfiles.patientId, patientId))
      .for("update");
    if (!antes) return { estado: "sin-cambio" };
    const anterior = (antes.sex ?? "").trim().toUpperCase();
    // MISMO VALOR, NADA QUE CORREGIR. Asi un doble clic, o dos pestañas abiertas, no dejan dos filas de
    // rastro afirmando una correccion que no cambio nada.
    if (anterior === sex) return { estado: "sin-cambio" };

    await tx.update(patientProfiles).set({ sex }).where(eq(patientProfiles.patientId, patientId));

    await recordAudit(tx, {
      event: "patient.sexo_corregido",
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      entityType: "patient",
      entityId: patientId,
      // DE QUE A QUE, Y POR QUE. Sin el valor viejo el rastro no explica por que dos diagnosticos del mismo
      // paciente clasifican distinto, que es justo lo que hay que poder reconstruir.
      payload: { sexo: sex, sexoAnterior: antes.sex, motivo },
      ip: actor.ip ?? null,
    });
    return { estado: "corregido", sexoAnterior: antes.sex };
  });
}
