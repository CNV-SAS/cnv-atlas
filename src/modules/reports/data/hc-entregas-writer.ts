import "server-only";

import { db } from "@/db";
import { hcDeliveries } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// REGISTRO DE LA ENTREGA DE LA HISTORIA CLINICA.
//
// LAS DOS ESCRITURAS VAN EN LA MISMA TRANSACCION, y son cosas distintas:
//   · `hc_deliveries` es el HECHO que el profesional consulta ("se la entregue el 2 de septiembre"). Vive
//     en una tabla de dominio con su RLS porque `clinical_audit_log` es admin-only para SELECT: un
//     registro que el profesional escribe y no ve nunca es medio registro.
//   · `clinical_audit_log` es el RASTRO inmutable del acto, con su actor y su IP, que es lo que se revisa
//     cuando alguien pregunta quien saco un documento con datos de salud.
//
// Inline, nunca por el bus (regla dura 8): sacar la historia clinica de un paciente es un evento clinico
// critico, y su rastro no puede depender de que otro proceso lo recoja.

export type HcDeliveryWrite = {
  evaluationId: string;
  patientId: string;
  sentTo: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function writeHcDelivery(input: HcDeliveryWrite): Promise<void> {
  await db.transaction(async (tx) => {
    const [fila] = await tx
      .insert(hcDeliveries)
      .values({
        evaluationId: input.evaluationId,
        patientId: input.patientId,
        medium: "email",
        sentTo: input.sentTo,
        deliveredBy: input.actorId,
        deliveredByEmail: input.actorEmail,
      })
      .returning({ id: hcDeliveries.id });

    await recordAudit(tx, {
      event: "hc.delivered",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      // El destino va al rastro: "se le envio a su correo" sin decir a cual no prueba nada, y el contacto
      // del paciente puede cambiar despues.
      payload: { delivery_id: fila?.id ?? null, medium: "email", sent_to: input.sentTo },
      ip: input.ip,
    });
  });
}

/**
 * Contacto del paciente de una evaluacion, para saber A DONDE se envia.
 *
 * Bajo RLS (regla dura 3): si la evaluacion no es del profesional, no hay fila y el servicio responde
 * "no encontrada" sin filtrar que existe.
 */
export async function getPatientContactForEvaluation(
  evaluationId: string,
): Promise<{ patientId: string; email: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select("patient_id, patients!inner(patient_contacts(email))")
    .eq("id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`hc-entregas-writer: contacto: ${error.message}`);
  if (!data) return null;

  const paciente = (Array.isArray(data.patients) ? data.patients[0] : data.patients) as
    | { patient_contacts: { email: string | null }[] | { email: string | null } | null }
    | undefined;
  const contacto = Array.isArray(paciente?.patient_contacts)
    ? paciente?.patient_contacts[0]
    : paciente?.patient_contacts;

  return { patientId: data.patient_id as string, email: contacto?.email ?? null };
}

/** ¿Cuándo se le entregó por última vez? Para decirlo en la pantalla, que es para lo que existe la tabla. */
export async function getUltimaEntregaHc(
  evaluationId: string,
): Promise<{ fecha: string; enviadaA: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hc_deliveries")
    .select("delivered_at, sent_to")
    .eq("evaluation_id", evaluationId)
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`hc-entregas-writer: ultima entrega: ${error.message}`);
  if (!data) return null;
  return { fecha: data.delivered_at as string, enviadaA: data.sent_to as string };
}
