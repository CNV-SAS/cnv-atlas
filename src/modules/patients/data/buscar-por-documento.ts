import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAudit } from "@/modules/audit/log";
import { db } from "@/db";
import { generarCodigoSoporte } from "../codigo-soporte";

// BUSQUEDA DE UN PACIENTE POR DOCUMENTO, ANTES DE CREARLO EN CONSULTA.
//
// POR QUE HACE FALTA SERVICE ROLE, que es una excepcion a la RLS y por eso va justificada aqui:
//
// La RLS solo deja ver al paciente PROPIO (`is_patient_professional`). Con la sesion del profesional, un
// documento de otro profesional de la misma organizacion "no existe", asi que la pantalla diria "no
// existe" y al crear reventaria el unique `patients_org_document_unique`.
//
// Y AHI ESTA EL ARGUMENTO: el error de la base YA REVELA el mismo hecho, peor redactado y sin control
// sobre las palabras ("duplicate key value violates unique constraint..."). **La alternativa no es no
// filtrar: es filtrar peor.** Con service role se decide con la verdad y se responde con lo minimo.
//
// EL UNIQUE ES POR ORGANIZACION, no global, asi que el caso real es "otro profesional de la MISMA
// organizacion". Entre organizaciones el mismo documento puede existir dos veces, y eso es correcto: son
// dos custodios distintos.
//
// LO QUE ESTA FUNCION DEVUELVE, y es todo lo que puede devolver: un veredicto de TRES ESTADOS. Nunca la
// fila, nunca el nombre, nunca de quien es. El candado (`buscar-por-documento.test.ts`) truena si algun
// dia el tipo de retorno gana un campo con datos del paciente.

export type VeredictoDocumento =
  /** No existe en la organizacion: se puede crear. */
  | { estado: "libre" }
  /** Existe y es de este profesional: se puede continuar. Solo viaja el id, que ya podia leer por RLS. */
  | { estado: "propio"; patientId: string; evaluacionPendienteId: string | null }
  /**
   * Existe y NO es de este profesional. NO viaja NADA mas.
   *
   * La reasignacion tiene su propio procedimiento (DATA_GOVERNANCE: exige consentimiento FRESCO del
   * paciente hacia el profesional entrante y transferencia formal de custodia), asi que no es algo que
   * esta pantalla pueda resolver: por eso manda a soporte y no ofrece un boton.
   */
  | { estado: "ajeno"; codigo: string };

export async function buscarPorDocumento(input: {
  organizationId: string;
  documentType: string;
  documentNumber: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<VeredictoDocumento> {
  // SERVICE ROLE: bypassa RLS a proposito, para poder distinguir "no existe" de "existe y no es tuyo".
  // Es la unica lectura de este modulo que lo hace, y lo que sale de aqui esta acotado por el tipo.
  const admin = createSupabaseAdminClient();
  const { data: paciente, error } = await admin
    .from("patients")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("document_type", input.documentType)
    .eq("document_number", input.documentNumber)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`buscar-por-documento: ${error.message}`);

  // QUEDA AUDITADO SIEMPRE, exista o no, y esta es la razon: un profesional consultando documentos ajenos
  // uno por uno podria mapear la organizacion. No se bloquea (la busqueda es legitima y bloquearla haria
  // imposible crear un paciente), pero queda rastro de quien pregunto por que documento y que se le
  // respondio. Sin el, el abuso seria indistinguible del uso normal.
  //
  // EL DOCUMENTO VA EN EL AUDIT, y es deliberado: sin el, el registro no sirve para lo que existe. El
  // audit log es admin-only para lectura (RLS), asi que no amplia quien puede verlo.
  // Codigo de referencia SOLO para el caso ajeno: es el unico en el que el profesional se queda sin poder
  // seguir y tiene que escribir a soporte. Aleatorio y nuevo en cada intento (ver `codigo-soporte.ts`):
  // no se deriva del documento ni del paciente, asi que no filtra por otra via lo que el mensaje calla.
  const veredicto: VeredictoDocumento["estado"] = !paciente
    ? "libre"
    : (await esDeEsteProfesional(paciente.id))
      ? "propio"
      : "ajeno";
  const codigo = veredicto === "ajeno" ? generarCodigoSoporte() : null;

  // EN SU PROPIA TRANSACCION: `recordAudit` escribe INLINE (regla dura 8) y espera un tx. Aqui no hay
  // nada mas que escribir, asi que la transaccion envuelve solo el audit; lo que importa es que NO pase
  // por el bus.
  await db.transaction(async (tx) =>
    recordAudit(tx, {
      event: "patient.document_lookup",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "patient",
      // Sin paciente no hay entidad: el id de la organizacion ubica el intento igual.
      entityId: paciente?.id ?? input.organizationId,
      payload: {
        document_type: input.documentType,
        document_number: input.documentNumber,
        veredicto,
        ...(veredicto === "ajeno" ? { codigo } : {}),
      },
      ip: input.ip,
    }),
  );

  if (veredicto === "libre") return { estado: "libre" };
  if (veredicto === "ajeno") return { estado: "ajeno", codigo: codigo! };

  // Solo en el caso PROPIO se lee algo mas, y se lee POR RLS (no con service role): si la RLS no lo deja
  // ver, es que no era propio, y el veredicto se habria equivocado.
  const supabase = await createSupabaseServerClient();
  const { data: pendiente } = await supabase
    .from("evaluations")
    .select("id")
    .eq("patient_id", paciente!.id)
    .eq("status", "awaiting_survey")
    .is("superseded_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    estado: "propio",
    patientId: paciente!.id,
    evaluacionPendienteId: (pendiente?.id as string | null) ?? null,
  };
}

/**
 * Si la RLS del profesional lo deja ver, es suyo. Se pregunta A LA RLS en vez de replicar la regla:
 * duplicar `is_patient_professional` aqui seria una segunda definicion de "es mio" que puede divergir de
 * la que de verdad gobierna el acceso.
 */
async function esDeEsteProfesional(patientId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("patients").select("id").eq("id", patientId).maybeSingle();
  return Boolean(data);
}
