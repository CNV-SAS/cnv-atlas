import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { correccionesDeFechaDeNacimiento, patientConsents, patientProfiles } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import { hechosDelConsentimiento, motivoDeRegularizacion } from "@/modules/consent/regularizacion";

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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CORREGIR UNA FECHA DE NACIMIENTO YA REGISTRADA  ·  0244, Santiago 2026-11-08
//
// ═══ ES OTRO ACTO, Y POR ESO ES OTRA FUNCION ═══
//
// `completarFechaDeNacimiento` rellena un hueco y su `where` lleva `is null`. Esto PISA un valor, que es
// justo lo que aquella se negaba a hacer. No se mezclan en una con una bandera: la bandera convertiria
// el camino seguro en el peligroso para quien la pase por descuido, y la razon de aquella (*"pisarla
// podria convertir un consentimiento firmado como adulto en uno que no autorizaba quien tenia que
// autorizarlo"*) no desaparece: se CUMPLE, detectandolo y diciendolo.
//
// ═══ LO QUE NO HACE, Y ES DELIBERADO ═══
//
// NO toca el consentimiento, NO reemite ningun diagnostico y NO esconde nada. Deja el dato corregido, su
// historia, y los dos hechos que se derivan de el a la vista: si la persona era menor al firmar (que la
// ficha ya sabe mostrar como "pendiente de regularizar") y que sus consultas selladas se diagnosticaron
// con otra edad (que la pantalla de recalibracion lee de estas filas).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type CorreccionDeFecha = {
  patientId: string;
  /** La fecha correcta, ya validada. */
  birthDate: string;
  motivo: string;
  /** De donde sale el dato nuevo. La lista la cierra el CHECK de la tabla. */
  fuente: string;
};

export type ResultadoDeLaCorreccion = {
  anterior: string | null;
  nueva: string;
  /** Si con la fecha NUEVA la persona era menor el dia que firmo. La pantalla lo dice en voz alta. */
  cambiaLaRamaDelConsentimiento: boolean;
};

/**
 * Corrige la fecha y deja su historia. `null` si el paciente no existe o la fecha es la misma.
 *
 * LA MISMA FECHA NO ES UNA CORRECCION: se devuelve `null` en vez de escribir una fila que no cambia
 * nada. El CHECK de la tabla lo impide tambien, por si alguien llega por otro camino.
 */
export async function corregirFechaDeNacimiento(
  input: CorreccionDeFecha,
  actor: ActorDeLaFecha,
): Promise<ResultadoDeLaCorreccion | null> {
  return db.transaction(async (tx) => {
    const [perfil] = await tx
      .select({ anterior: patientProfiles.birthDate })
      .from(patientProfiles)
      .where(eq(patientProfiles.patientId, input.patientId))
      .limit(1);
    if (!perfil) return null;
    if (perfil.anterior === input.birthDate) return null;

    // ═══ LA RAMA DEL CONSENTIMIENTO SE MIRA ANTES DE ESCRIBIR, Y CON LAS DOS FECHAS ═══
    //
    // Lo que importa no es la edad de HOY: es si la persona era menor EL DIA QUE FIRMO. Esa fecha de
    // firma no cambia, asi que la pregunta se contesta aqui, con la fecha nueva, y se guarda en la fila.
    const firmas = await tx
      .select({ type: patientConsents.consentType, signedAt: patientConsents.signedAt })
      .from(patientConsents)
      .where(
        and(eq(patientConsents.patientId, input.patientId), isNull(patientConsents.revokedAt)),
      );
    const conLaNueva = motivoDeRegularizacion(
      hechosDelConsentimiento({
        fechaDeNacimiento: input.birthDate,
        consents: firmas.map((f) => ({
          consent_type: f.type,
          signed_at: f.signedAt?.toISOString() ?? null,
        })),
      }),
    );
    const conLaVieja = motivoDeRegularizacion(
      hechosDelConsentimiento({
        fechaDeNacimiento: perfil.anterior,
        consents: firmas.map((f) => ({
          consent_type: f.type,
          signed_at: f.signedAt?.toISOString() ?? null,
        })),
      }),
    );
    // CAMBIA LA RAMA cuando con la fecha nueva hay un motivo de regularizacion que antes no habia, o al
    // reves: los dos sentidos importan. Corregir una fecha puede DESTAPAR que firmo siendo menor, y
    // tambien puede LIMPIAR una alarma que existia por un digito mal tecleado.
    const cambia = (conLaNueva?.clave ?? null) !== (conLaVieja?.clave ?? null);

    await tx
      .update(patientProfiles)
      .set({ birthDate: input.birthDate })
      .where(eq(patientProfiles.patientId, input.patientId));

    await tx.insert(correccionesDeFechaDeNacimiento).values({
      patientId: input.patientId,
      anterior: perfil.anterior,
      nueva: input.birthDate,
      motivo: input.motivo,
      fuente: input.fuente,
      corregidaPor: actor.actorId,
      cambiaLaRamaDelConsentimiento: cambia,
    });

    await recordAudit(tx, {
      event: "patient.fecha_de_nacimiento_corregida",
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      entityType: "patient",
      entityId: input.patientId,
      // LAS DOS FECHAS VAN AL RASTRO. La edad entra al diagnostico por cuatro puertas y decide la rama
      // del consentimiento: quien audite esto necesita poder reconstruir que se diagnostico con cual.
      payload: {
        anterior: perfil.anterior,
        nueva: input.birthDate,
        motivo: input.motivo,
        fuente: input.fuente,
        cambia_la_rama_del_consentimiento: cambia,
      },
      ip: actor.ip ?? null,
    });

    return { anterior: perfil.anterior, nueva: input.birthDate, cambiaLaRamaDelConsentimiento: cambia };
  });
}
