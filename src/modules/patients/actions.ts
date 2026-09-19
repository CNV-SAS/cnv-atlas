"use server";

import { getClientIp } from "@/core/http/client-ip";
import { limitDocumentLookupByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { buscarPorDocumento } from "./data/buscar-por-documento";
import { guardarContactoDelPaciente } from "./data/patient-contact-writer";
import { getPatientDetail } from "./data/patient-detail-reader";
import { setPatientArchivado } from "./data/patients-archive-writer";
import { canArchivePatient } from "./policies/can-archive-patient";
import { canEditPatientContact } from "./policies/can-edit-patient-contact";
import { canCreatePatientPresencial } from "./policies/can-create-patient";
import { documentoAjenoParaProfesional } from "./text/documento-ajeno";
import type { ArchivarPacienteState, ContactoPacienteState, VerificarDocumentoState } from "./types";
import { archivarPacienteSchema, contactoPacienteSchema, documentoSchema } from "./validations";

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

// ═══ CORREGIR EL CONTACTO DEL PACIENTE (2026-09-19) ═══
//
// EL CASO QUE LO PIDE: en el smoke, un paciente que empeoró no tenía correo, así que no se le podía
// entregar ni el reporte ni la historia clínica, y no había forma de agregárselo. La ficha era de solo
// lectura entera.
//
// SOLO CONTACTO. Nombre, documento y fecha de nacimiento siguen sin editarse: ver el porqué en
// `can-edit-patient-contact`. Esto no es media solución del backlog, es la parte que no depende de la
// decisión pendiente.
//
// LA OWNERSHIP SE VERIFICA LEYENDO bajo RLS antes de escribir (mismo patrón que el resto del proyecto):
// si el paciente no es suyo, el lector no lo alcanza y aquí es indistinguible de que no exista.
export async function guardarContactoPacienteAction(
  _prev: ContactoPacienteState,
  form: FormData,
): Promise<ContactoPacienteState> {
  const user = await requireUser();
  if (!canEditPatientContact(user)) return { error: "No autorizado.", success: null, warning: null };

  const datos = contactoPacienteSchema.safeParse({
    patientId: form.get("patientId"),
    email: form.get("email"),
    phone: form.get("phone"),
  });
  if (!datos.success) {
    return {
      error: datos.error.issues[0]?.message ?? "Revisa los datos de contacto.",
      success: null,
      warning: null,
    };
  }

  const paciente = await getPatientDetail(datos.data.patientId);
  if (!paciente) return { error: "No se encontró ese paciente.", success: null, warning: null };

  const ip = await getClientIp();
  await guardarContactoDelPaciente(datos.data, {
    actorId: user.id,
    actorEmail: user.email,
    // EL VALOR ANTERIOR viaja desde aquí, que es donde se acaba de leer: el writer no vuelve a
    // consultarlo para no dejar una ventana entre la lectura y la escritura.
    anterior: { email: paciente.email, phone: paciente.phone },
    ip: ip === "unknown" ? null : ip,
  });

  // No revalida: el refresco lo hace la pantalla tras el aviso (misma razón que en archivar, el candado
  // del doble ciclo).
  return {
    error: null,
    success: datos.data.email
      ? "Contacto actualizado. Ya se le puede enviar su documentación."
      : "Contacto actualizado.",
    warning: null,
  };
}
