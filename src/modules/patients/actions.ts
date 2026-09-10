"use server";

import { getClientIp } from "@/core/http/client-ip";
import { limitDocumentLookupByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { buscarPorDocumento } from "./data/buscar-por-documento";
import { setPatientArchivado } from "./data/patients-archive-writer";
import { canArchivePatient } from "./policies/can-archive-patient";
import { canCreatePatientPresencial } from "./policies/can-create-patient";
import { documentoAjenoParaProfesional } from "./text/documento-ajeno";
import type { ArchivarPacienteState, VerificarDocumentoState } from "./types";
import { archivarPacienteSchema, documentoSchema } from "./validations";

// PRIMER PASO de crear un paciente en consulta: saber si ese documento ya esta en la organizacion.
//
// POR QUE ES UN PASO Y NO UNA VALIDACION AL GUARDAR. Sin el, los tres caminos terminan igual de mal:
//   - el paciente EXISTE y es suyo -> se crearia un duplicado, y lo impide el unique... con un error de
//     Postgres en la cara;
//   - el paciente existe y es de OTRO profesional -> la RLS no se lo deja ver, asi que la pantalla diria
//     "no existe" y reventaria igual;
//   - y solo el tercero, que no existe, funcionaba.
// Preguntarlo primero convierte los tres en una respuesta escrita por nosotros.

const vacio = (error: string | null): VerificarDocumentoState => ({
  error,
  veredicto: null,
  documentType: null,
  documentNumber: null,
  patientId: null,
  evaluacionPendienteId: null,
});

export async function verificarDocumentoAction(
  _prev: VerificarDocumentoState,
  form: FormData,
): Promise<VerificarDocumentoState> {
  const user = await requireUser();
  if (!canCreatePatientPresencial(user)) return vacio("No autorizado.");

  const parsed = documentoSchema.safeParse({
    documentType: (form.get("documentType") as string | null)?.trim() ?? "",
    documentNumber: (form.get("documentNumber") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) return vacio("Revisa el tipo y el número de documento.");

  // El limite acota el BARRIDO, no el uso (60/h). La auditoria de la busqueda es el control de verdad;
  // esto solo impide hacerlo rapido.
  const limite = await limitDocumentLookupByUser(user.id);
  if (!limite.success) {
    return vacio("Demasiadas búsquedas seguidas. Espera unos minutos e intenta de nuevo.");
  }

  const ip = await getClientIp();
  const veredicto = await buscarPorDocumento({
    organizationId: user.organizationId,
    documentType: parsed.data.documentType,
    documentNumber: parsed.data.documentNumber,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });

  const eco = {
    documentType: parsed.data.documentType,
    documentNumber: parsed.data.documentNumber,
  };

  if (veredicto.estado === "ajeno") {
    return { ...vacio(documentoAjenoParaProfesional(veredicto.codigo)), ...eco, veredicto: "ajeno" };
  }
  if (veredicto.estado === "libre") {
    return { ...vacio(null), ...eco, veredicto: "libre" };
  }
  return {
    error: null,
    veredicto: "propio",
    ...eco,
    patientId: veredicto.patientId,
    evaluacionPendienteId: veredicto.evaluacionPendienteId,
  };
}

// ═══ ARCHIVAR Y DESARCHIVAR UN PACIENTE (Santiago, 2026-09-10) ═══
//
// UNA SOLA ACCION PARA LAS DOS, con el destino en el formulario, y no dos acciones simetricas: el boton
// que se pinta depende del estado actual, asi que separarlas obligaria a la pantalla a elegir cual invocar
// y a las dos a repetir la misma policy y el mismo actor. Lo que cambia es un booleano.
//
// NO ES BORRAR: mueve `patients.status` y no toca nada mas. Ver `patients-archive-writer`.
export async function archivarPacienteAction(
  _prev: ArchivarPacienteState,
  form: FormData,
): Promise<ArchivarPacienteState> {
  const user = await requireUser();
  if (!canArchivePatient(user)) return { error: "No autorizado.", success: null, warning: null };

  const datos = archivarPacienteSchema.safeParse({
    patientId: form.get("patientId"),
    archivar: form.get("archivar") === "1",
  });
  if (!datos.success) return { error: "Datos inválidos.", success: null, warning: null };

  const ip = await getClientIp();
  const ok = await setPatientArchivado(datos.data, {
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  // LA RLS YA DECIDIO: si no alcanzo la fila, para quien llama es lo mismo que no existir. No se
  // distingue "no existe" de "no es tuyo", que seria decirle a un profesional que hay un paciente ajeno.
  if (!ok) return { error: "No se encontró ese paciente.", success: null, warning: null };

  // ═══ NO REVALIDA, Y EL CANDADO DEL DOBLE CICLO ME LO DIJO ═══
  //
  // La primera version llamaba a `revalidatePath` aqui Y la pantalla usa `useFormToastAndRefresh`. Eso es
  // exactamente lo que `refresco-una-sola-vez` prohibe: dos ciclos que montan segmentos, o sea dos saltos
  // al inicio, y el formulario desmontado antes de que se vea el aviso.
  //
  // EL REFRESCO LO HACE LA PANTALLA, despues del toast. Es la misma decision que ya esta tomada en el
  // guardado de medidas y en el panel de tratamiento.
  return {
    error: null,
    success: datos.data.archivar
      ? "Paciente archivado. Sigue completo: se puede desarchivar cuando quieras."
      : "Paciente desarchivado.",
    warning: null,
  };
}
