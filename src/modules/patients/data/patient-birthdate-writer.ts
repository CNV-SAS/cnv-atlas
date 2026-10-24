import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { patientProfiles } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// COMPLETAR LA FECHA DE NACIMIENTO DE UN PACIENTE AL QUE LE FALTA.
//
// ── POR QUE HACE FALTA, Y POR QUE LLEGA HOY Y NO ANTES ────────────────────────────────────────────
//
// Hasta el 2026-10-24 faltar la fecha no frenaba nada: `computeAge` devolvia 0 y el motor seguia. Ese 0
// no se quedaba quieto (inventaba el IAE, perdia la clasificacion de capacitancia y se volvia 30 en el
// GEB de la cadena calorica), asi que la edad pasa a FALLAR EN VOZ ALTA, como el sexo. Y un freno sin
// salida no es un guard: detiene a una persona. Esta es la salida.
//
// SON 15 PACIENTES REALES, medidos en produccion el 2026-10-24 (527 perfiles reales, 512 con fecha
// legible, 15 sin ella, CERO con una fecha imposible). Los 15 vienen del lote del HTML, que trae la fecha
// solo cuando el archivo la tiene; el intake si la exige, y el seguimiento no vuelve a tocar el perfil.
//
// ── RELLENA UN HUECO, NUNCA PISA UN VALOR, Y LO IMPONE EL `where` ─────────────────────────────────
//
// El `update` lleva en su propia condicion que la fecha este NULA. No es una comprobacion previa que
// luego se escribe: entre leer y escribir cabe otra escritura. Si ya habia una fecha, no se actualiza
// ninguna fila y la funcion devuelve `false`.
//
// Y LA RAZON DE FONDO: la fecha de nacimiento decide la RAMA DEL CONSENTIMIENTO (mayor o menor de edad).
// Pisarla podria convertir un consentimiento firmado como adulto en uno que no autorizaba quien tenia
// que autorizarlo, y eso no se arregla por detras. Corregir una fecha YA registrada es otro acto, con su
// motivo y su rastro, y todavia NO esta construido (no hace falta hoy: no hay ninguna imposible).
//
// ── LO QUE SI PUEDE DESTAPAR, Y YA TIENE SU MECANISMO ─────────────────────────────────────────────
//
// Que el paciente fuera MENOR el dia que firmo. Eso no lo decide esta funcion ni lo oculta: lo deriva
// `motivoDeRegularizacion` (modules/consent/regularizacion.ts) en cuanto la fecha existe, y aparece como
// "pendiente de regularizar" en la lista y en la ficha. O sea que completar el dato no crea un problema
// nuevo: destapa uno que estaba invisible por falta del dato, que es exactamente lo que queremos.
//
// ── Y QUEDA EN EL RASTRO CLINICO, inline en la transaccion (regla dura 8) ─────────────────────────
//
// La edad entra al diagnostico por cuatro puertas, asi que quien la registro y cuando es parte de la
// historia del diagnostico, no un detalle administrativo.
export type FechaDeNacimientoDelPaciente = { patientId: string; birthDate: string };

export type ActorDeLaFecha = {
  actorId: string;
  actorEmail: string | null;
  ip?: string | null;
};

/** `true` si la escribio; `false` si el paciente ya tenia una fecha y no se toco nada. */
export async function completarFechaDeNacimiento(
  { patientId, birthDate }: FechaDeNacimientoDelPaciente,
  actor: ActorDeLaFecha,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [escrito] = await tx
      .update(patientProfiles)
      .set({ birthDate })
      .where(
        and(
          eq(patientProfiles.patientId, patientId),
          // La columna es `date`, asi que vacio solo puede ser NULO: no cabe una cadena en blanco como en
          // el sexo (que es `text`). Por eso aqui no hay `btrim`.
          sql`${patientProfiles.birthDate} is null`,
        ),
      )
      .returning({ patientId: patientProfiles.patientId });
    if (!escrito) return false;

    await recordAudit(tx, {
      event: "patient.fecha_de_nacimiento_completada",
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      entityType: "patient",
      entityId: patientId,
      // EL VALOR SI VA AL RASTRO: es insumo del diagnostico (la edad) y de la rama del consentimiento,
      // no un dato de contacto.
      payload: { fechaDeNacimiento: birthDate, estaba: "vacia" },
      ip: actor.ip ?? null,
    });
    return true;
  });
}
