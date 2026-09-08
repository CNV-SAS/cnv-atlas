import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generarCodigoSoporte } from "../codigo-soporte";
import { recordAudit } from "@/modules/audit/log";
import { db } from "@/db";

// ¿EL PACIENTE QUE RESOLVIO EL DOCUMENTO ES DE ESTE PROFESIONAL? Preguntado desde el INTAKE PUBLICO, que
// no tiene sesion.
//
// EL HUECO QUE CIERRA, verificado antes de construir: el enlace de consultorio es publico (esta pensado
// para imprimirse y pegarse en la sala). Tecleando ahi la cedula de un paciente de OTRO profesional de la
// organizacion, la resolucion por documento devolvia modo 'seguimiento' y el writer insertaba la relacion
// paciente-profesional. Esa fila es la que lee `is_patient_professional`, y esa funcion gobierna las
// policies de patients, patient_profiles, patient_consents y evaluations.
//
// Asi que no era un problema de atribucion: **el profesional quedaba con acceso permanente a la historia
// clinica completa de un paciente que no era suyo**, y el gate de la regla dura 15 no lo paraba (el
// paciente ya tenia sus autorizaciones vigentes).
//
// POR QUE POR RPC Y NO CON UNA CONSULTA AQUI. `is_patient_professional` no sirve en esta superficie:
// resuelve el profesional por `auth.uid()` y aqui no hay sesion. Y escribir la consulta a mano seria una
// SEGUNDA definicion de "es de este profesional", capaz de divergir de la que de verdad gobierna el
// acceso. La 0106 saco la regla a `is_patient_of(paciente, profesional)` y dejo al helper de siempre
// llamandola: una sola definicion, dos formas de preguntar.
//
// LA COMPROBACION Y EL RASTRO VAN JUNTOS A PROPOSITO. Separarlos dejaria un sitio de llamada donde se
// puede comprobar y olvidar el registro, que es la forma de defecto que ya nos mordio: el guard existia
// y nadie lo llamaba. Aqui no hay forma de preguntar sin dejar rastro cuando la respuesta es que no.
export async function esPacienteDelEnlace(input: {
  patientId: string;
  /** professional_profiles.id del profesional DUEÑO DEL ENLACE, no de una sesion. */
  professionalId: string;
  documentType: string;
  documentNumber: string;
  ip: string | null;
}): Promise<{ suyo: true } | { suyo: false; codigo: string }> {
  // SERVICE ROLE: superficie publica sin sesion (SECURITY.md). La funcion es `security definer` y solo
  // devuelve un booleano; no hay fila que se pueda filtrar por aqui.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("is_patient_of", {
    p_patient_id: input.patientId,
    p_professional_id: input.professionalId,
  });
  if (error) throw new Error(`paciente-del-enlace: ${error.message}`);
  if (data === true) return { suyo: true };

  // El codigo se genera AQUI, junto al registro, y no en la pantalla: asi no hay forma de enseñar uno que
  // no este guardado, que seria peor que no darlo (soporte no encontraria nada).
  const codigo = generarCodigoSoporte();

  // NO SE BLOQUEA EN SILENCIO. Un intento asi puede ser un paciente que cambio de profesional (legitimo,
  // y se resuelve por el procedimiento de reasignacion) o un profesional buscandose acceso. El registro
  // es lo unico que distingue los dos despues, y el audit log es admin-only para lectura.
  await db.transaction(async (tx) =>
    recordAudit(tx, {
      event: "patient.intake_blocked_not_owner",
      actorId: null,
      actorEmail: null,
      entityType: "patient",
      entityId: input.patientId,
      payload: {
        professional_id: input.professionalId,
        document_type: input.documentType,
        document_number: input.documentNumber,
        codigo,
      },
      ip: input.ip,
    }),
  );
  return { suyo: false, codigo };
}
