import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { patientContacts } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// CORREGIR EL CONTACTO DEL PACIENTE (correo y telefono).
//
// ── UN UPSERT, PORQUE LA FILA PUEDE NO EXISTIR ─────────────────────────────────────────────────────
//
// `patient_contacts` se crea con el intake. Un paciente creado en consulta, o uno cuyo intake no pidio
// correo, no tiene fila: por eso se inserta con `onConflictDoUpdate` sobre la PK (`patient_id`) en vez de
// actualizar a ciegas, que dejaria el guardado sin efecto y sin error (el peor desenlace: la pantalla
// diria "guardado" y el correo seguiria sin existir).
//
// ── EL VALOR ANTERIOR VA AL RASTRO ─────────────────────────────────────────────────────────────────
//
// Inline en la transaccion (regla dura 8). Y con lo que HABIA, no solo con lo nuevo: cuando alguien
// pregunte "por que no le llego el reporte", el rastro tiene que poder decir a donde se mando entonces y
// quien lo cambio despues. Un contacto que cambia sin registro convierte eso en una discusion sin datos.
//
// LA AUTORIZACION NO SE DECIDE AQUI (regla dura 3): la action verifica la policy y LEE el paciente bajo
// RLS antes de llamar, que es lo que garantiza que sea suyo.

export type ContactoDelPaciente = {
  patientId: string;
  /** null = se deja sin correo (borrarlo es una correccion valida: un correo equivocado es peor que ninguno). */
  email: string | null;
  phone: string | null;
};

export type ActorDelContacto = {
  actorId: string;
  actorEmail: string | null;
  anterior: { email: string | null; phone: string | null };
  ip?: string | null;
};

export async function guardarContactoDelPaciente(
  { patientId, email, phone }: ContactoDelPaciente,
  actor: ActorDelContacto,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(patientContacts)
      .values({ patientId, email, phone })
      .onConflictDoUpdate({
        target: patientContacts.patientId,
        set: { email, phone },
        where: eq(patientContacts.patientId, patientId),
      });

    await recordAudit(tx, {
      event: "patient.contact_updated",
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      entityType: "patient",
      entityId: patientId,
      payload: {
        email_anterior: actor.anterior.email,
        email_nuevo: email,
        telefono_anterior: actor.anterior.phone,
        telefono_nuevo: phone,
      },
      ip: actor.ip ?? null,
    });
  });
}
