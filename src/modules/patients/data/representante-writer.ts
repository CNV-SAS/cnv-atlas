import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { patientConsents } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COMPLETAR O CORREGIR EL REPRESENTANTE LEGAL DE UN PACIENTE MENOR  ·  2026-11-19
//
// ═══ POR QUE HACE FALTA ESTA PUERTA ═══
//
// El representante se captura en el flujo de CONSENTIMIENTO, y eso cubre a quien firma de aqui en
// adelante. Lo que no cubre es lo que ya esta:
//
//   · los menores que firmaron SIN representante (el aviso "Consentimiento de menor sin representante"
//     existe justo para nombrarlos), y
//   · los que tienen representante pero SIN TIPO de documento, porque la columna nacio hoy (0247).
//
// Sin esta puerta, esos pacientes no se pueden facturar nunca: la venta quedaria pendiente para siempre
// y la unica salida seria volver a firmar el consentimiento entero, que es un acto distinto y mucho mas
// pesado. Un freno sin salida no es un guard: detiene a una persona.
//
// ═══ QUE TOCA Y QUE NO ═══
//
// TOCA la fila de autorizacion VIGENTE de tipo `representante_legal`, que es donde viven esos campos
// desde la 0008. NO crea la autorizacion si no existe: firmar un consentimiento es un acto del paciente
// y de su representante, no algo que se teclee desde la ficha. Si no hay autorizacion, se dice.
//
// Y NO TOCA el hash del documento, ni la version, ni la fecha de firma, ni el canal: lo que se corrige es
// la IDENTIFICACION de quien ya autorizo, no el acto de autorizar.
//
// ═══ EL VALOR ANTERIOR QUEDA EN LA AUDITORIA ═══
//
// Es la misma respuesta que ya se dio para el contacto del paciente: un dato de identificacion que cambia
// sin rastro convierte "la factura salio a nombre de quien no era" en una discusion sin datos. Y aqui pesa
// mas, porque de este dato sale un documento tributario.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type RepresentanteDeLaFicha = {
  patientId: string;
  nombre: string;
  tipoDocumento: "CC" | "CE" | "PA";
  documento: string;
  parentesco: string;
  correo: string | null;
};

export type ActorDelRepresentante = {
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type ResultadoDelRepresentante =
  | { ok: true }
  | { ok: false; motivo: "sin_autorizacion" };

/** Lo que hay hoy, para rellenar el formulario y para dejarlo en la auditoria. */
export async function leerRepresentanteVigente(patientId: string): Promise<{
  consentId: string;
  nombre: string | null;
  tipoDocumento: string | null;
  documento: string | null;
  parentesco: string | null;
  correo: string | null;
} | null> {
  const [c] = await db
    .select({
      consentId: patientConsents.id,
      nombre: patientConsents.legalRepresentativeName,
      tipoDocumento: patientConsents.legalRepresentativeDocumentType,
      documento: patientConsents.legalRepresentativeDocument,
      parentesco: patientConsents.legalRepresentativeRelationship,
      correo: patientConsents.legalRepresentativeEmail,
    })
    .from(patientConsents)
    .where(
      and(
        eq(patientConsents.patientId, patientId),
        eq(patientConsents.consentType, "representante_legal"),
        isNull(patientConsents.revokedAt),
      ),
    )
    // LA MAS RECIENTE: si alguien revoco y volvio a firmar con otro representante, manda el ultimo. Es el
    // mismo criterio con el que lo lee la facturacion, y tenerlo distinto en los dos sitios es como se
    // llega a que la ficha muestre un representante y la factura salga a nombre de otro.
    .orderBy(desc(patientConsents.signedAt))
    .limit(1);
  return c ?? null;
}

export async function guardarRepresentanteDelPaciente(
  datos: RepresentanteDeLaFicha,
  actor: ActorDelRepresentante,
): Promise<ResultadoDelRepresentante> {
  const actual = await leerRepresentanteVigente(datos.patientId);
  if (!actual) return { ok: false, motivo: "sin_autorizacion" };

  await db.transaction(async (tx) => {
    await tx
      .update(patientConsents)
      .set({
        legalRepresentativeName: datos.nombre,
        legalRepresentativeDocumentType: datos.tipoDocumento,
        legalRepresentativeDocument: datos.documento,
        legalRepresentativeRelationship: datos.parentesco,
        legalRepresentativeEmail: datos.correo,
      })
      .where(eq(patientConsents.id, actual.consentId));

    await recordAudit(tx, {
      event: "patient.legal_representative_updated",
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      entityType: "patient",
      entityId: datos.patientId,
      // EL ANTES Y EL DESPUES, los dos. De este dato sale un documento tributario: saber que cambio sin
      // saber que habia no responde la pregunta que alguien va a hacer.
      payload: {
        consent_id: actual.consentId,
        nombre_anterior: actual.nombre,
        nombre_nuevo: datos.nombre,
        tipo_documento_anterior: actual.tipoDocumento,
        tipo_documento_nuevo: datos.tipoDocumento,
        documento_anterior: actual.documento,
        documento_nuevo: datos.documento,
        parentesco_anterior: actual.parentesco,
        parentesco_nuevo: datos.parentesco,
        correo_anterior: actual.correo,
        correo_nuevo: datos.correo,
      },
      ip: actor.ip ?? null,
    });
  });

  return { ok: true };
}
