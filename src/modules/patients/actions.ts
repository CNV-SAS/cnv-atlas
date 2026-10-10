"use server";

import { getClientIp } from "@/core/http/client-ip";
import { limitDocumentLookupByUser } from "@/core/rate-limit";
import { canAccessAdmin } from "@/modules/auth/policies/can-access-admin";
import { requireUser } from "@/modules/auth/session";
import { reportServerError } from "@/lib/observability/report-error";

import { buscarPorDocumento } from "./data/buscar-por-documento";
import {
  desmarcarPacienteDePrueba,
  confirmarPacienteReal,
  marcarPacienteDePruebaDirecto,
  MarcaDePruebaError,
  proponerPacienteDePrueba,
  resolverPropuestaDePrueba,
} from "./data/de-prueba-writer";
import { guardarContactoDelPaciente } from "./data/patient-contact-writer";
import { completarSexoDelPaciente } from "./data/patient-sex-writer";
import { getPatientDetail } from "./data/patient-detail-reader";
import { setPatientArchivado } from "./data/patients-archive-writer";
import { canArchivePatient } from "./policies/can-archive-patient";
import { canCompletePatientSex } from "./policies/can-complete-patient-sex";
import { canEditPatientContact } from "./policies/can-edit-patient-contact";
import { canCreatePatientPresencial } from "./policies/can-create-patient";
import { documentoAjenoParaProfesional } from "./text/documento-ajeno";
import type {
  ArchivarPacienteState,
  ContactoPacienteState,
  SexoPacienteState,
  VerificarDocumentoState,
} from "./types";
import {
  archivarPacienteSchema,
  contactoPacienteSchema,
  documentoSchema,
  sexoPacienteSchema,
} from "./validations";

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

// ═══ COMPLETAR EL SEXO QUE FALTA (Sentry, 2026-10-10) ═══
//
// LA PANTALLA QUE NO EXISTIA. Habia pacientes sin sexo (el import del HTML lo deja en null cuando no
// reconoce la palabra del archivo) y el motor lo exige estricto, asi que su diagnostico era imposible y
// el unico remedio era un script contra la base. El profesional veia un 500.
//
// SOLO RELLENA UN HUECO: si el paciente ya tenia un sexo, el writer no actualiza nada y aqui se dice. Ver
// `can-complete-patient-sex` (por que esto no es el bloque diferido de corregir datos personales) y
// `patient-sex-writer` (por que el `where` es la frontera y no una comprobacion previa).
export async function completarSexoPacienteAction(
  _prev: SexoPacienteState,
  form: FormData,
): Promise<SexoPacienteState> {
  const user = await requireUser();
  if (!canCompletePatientSex(user)) return { error: "No autorizado.", success: null, warning: null };

  const datos = sexoPacienteSchema.safeParse({
    patientId: form.get("patientId"),
    sex: form.get("sex"),
  });
  if (!datos.success) {
    return {
      error: datos.error.issues[0]?.message ?? "Elige Femenino o Masculino.",
      success: null,
      warning: null,
    };
  }

  // LA OWNERSHIP SE VERIFICA LEYENDO bajo RLS antes de escribir (mismo patron que el contacto): si el
  // paciente no es suyo, el lector no lo alcanza y aqui es indistinguible de que no exista.
  const paciente = await getPatientDetail(datos.data.patientId);
  if (!paciente) return { error: "No se encontró ese paciente.", success: null, warning: null };

  const ip = await getClientIp();
  const escrito = await completarSexoDelPaciente(datos.data, {
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!escrito) {
    // NO ES UN FALLO: alguien lo completo mientras esta pantalla estaba abierta, o el dato ya estaba. Se
    // dice lo que hay, sin afirmar que se guardo algo que no se guardo.
    return {
      error: null,
      success: null,
      warning: "Este paciente ya tenía el sexo registrado, así que no se cambió nada. Refresca la ficha para verlo.",
    };
  }

  // No revalida: el refresco lo hace la pantalla tras el aviso (el candado del doble ciclo,
  // `refresco-una-sola-vez`: nunca revalidatePath Y refresco de cliente).
  return {
    error: null,
    success: "Sexo registrado. Ya se le puede generar el diagnóstico.",
    warning: null,
  };
}

// ═══ MARCAR UN PACIENTE COMO DE PRUEBA (0180, 2026-09-25) ═══
//
// DOS ACTOS Y DOS PERMISOS DISTINTOS, y eso es el diseño, no un detalle: el profesional PROPONE y admin
// CONFIRMA. Marcar saca al paciente de las cifras, asi que quien se beneficia de la exclusion no puede
// autorizarla (ver `de-prueba-writer.ts`).

export type MarcaDePruebaState = { error: string | null; success: string | null; warning: string | null };

/** El profesional propone. `canArchivePatient` es el permiso correcto: es el mismo alcance (su paciente). */
export async function proponerPacienteDePruebaAction(
  _prev: MarcaDePruebaState,
  form: FormData,
): Promise<MarcaDePruebaState> {
  const user = await requireUser();
  if (!canArchivePatient(user)) return { error: "No autorizado.", success: null, warning: null };
  try {
    await proponerPacienteDePrueba({
      patientId: String(form.get("patientId") ?? ""),
      motivo: String(form.get("motivo") ?? ""),
      actorId: user.id,
      actorEmail: user.email,
      ip: await getClientIp(),
    });
    // NO REVALIDA: la pantalla refresca con `useFormToastAndRefresh` (regla `refresco-una-sola-vez`, y el
    // candado de este archivo lo vigila). Con los dos, el formulario se desmonta antes de que se vea el aviso.
    return {
      error: null,
      success: null,
      // ES UN AVISO, NO UN EXITO, y el tono importa: lo que dice es que TODAVIA NO PASO NADA. Sin esa frase, el
      // profesional cree que ya quedo fuera de las cifras y al ver el conteo igual piensa que el sistema falla.
      warning:
        "Propuesto como de prueba. Un administrador lo confirma; hasta entonces sigue contando en las cifras.",
    };
  } catch (e) {
    if (e instanceof MarcaDePruebaError) return { error: e.message, success: null, warning: null };
    reportServerError("paciente.proponer-de-prueba", e);
    return { error: "No se pudo registrar la propuesta.", success: null, warning: null };
  }
}

/** Admin resuelve: confirmar saca al paciente de las cifras, rechazar limpia la propuesta. */
export async function resolverPropuestaDePruebaAction(
  _prev: MarcaDePruebaState,
  form: FormData,
): Promise<MarcaDePruebaState> {
  const user = await requireUser();
  if (!canAccessAdmin(user)) return { error: "Solo un administrador confirma esto.", success: null, warning: null };
  const confirmar = String(form.get("confirmar") ?? "") === "true";
  try {
    await resolverPropuestaDePrueba({
      patientId: String(form.get("patientId") ?? ""),
      confirmar,
      actorId: user.id,
      actorEmail: user.email,
      ip: await getClientIp(),
    });
    // No revalida: la pantalla refresca (ver arriba).
    return {
      error: null,
      warning: null,
      success: confirmar
        ? "Marcado como de prueba. Sale de las cifras y no se factura; sigue visible en la lista."
        : "Propuesta rechazada. El paciente sigue contando como cualquier otro.",
    };
  } catch (e) {
    if (e instanceof MarcaDePruebaError) return { error: e.message, success: null, warning: null };
    reportServerError("paciente.resolver-de-prueba", e);
    return { error: "No se pudo resolver la propuesta.", success: null, warning: null };
  }
}

/** Desmarcar: un paciente real marcado por error vuelve a contar. Solo admin, por simetria. */
export async function desmarcarPacienteDePruebaAction(
  _prev: MarcaDePruebaState,
  form: FormData,
): Promise<MarcaDePruebaState> {
  const user = await requireUser();
  if (!canAccessAdmin(user)) return { error: "Solo un administrador puede desmarcarlo.", success: null, warning: null };
  try {
    await desmarcarPacienteDePrueba({
      patientId: String(form.get("patientId") ?? ""),
      actorId: user.id,
      actorEmail: user.email,
      ip: await getClientIp(),
    });
    // No revalida: la pantalla refresca (ver arriba).
    return { error: null, success: "Ya no está marcado como de prueba. Vuelve a contar en las cifras.", warning: null };
  } catch (e) {
    if (e instanceof MarcaDePruebaError) return { error: e.message, success: null, warning: null };
    reportServerError("paciente.desmarcar-de-prueba", e);
    return { error: "No se pudo desmarcarlo.", success: null, warning: null };
  }
}

/**
 * MARCAR DIRECTAMENTE, sin propuesta previa (Santiago, 2026-10-01).
 *
 * El camino de proponer y confirmar sirve cuando alguien reconoce al paciente. No sirve para limpiar los
 * pacientes de una cuenta de demostracion, donde el profesional no va a proponer nada. Sigue siendo decision
 * de admin, con su motivo y su registro: lo que se salta es la propuesta, no la huella.
 */
export async function marcarPacienteDePruebaAction(
  _prev: MarcaDePruebaState,
  form: FormData,
): Promise<MarcaDePruebaState> {
  const user = await requireUser();
  if (!canAccessAdmin(user)) {
    return { error: "Solo un administrador puede marcarlo.", success: null, warning: null };
  }
  try {
    await marcarPacienteDePruebaDirecto({
      patientId: String(form.get("patientId") ?? ""),
      motivo: String(form.get("motivo") ?? ""),
      actorId: user.id,
      actorEmail: user.email,
      ip: await getClientIp(),
    });
    return {
      error: null,
      warning: null,
      success:
        "Marcado como de prueba. Sus ventas, su diagnóstico y su data salen de las cifras y no se factura; sigue visible en la lista.",
    };
  } catch (e) {
    if (e instanceof MarcaDePruebaError) return { error: e.message, success: null, warning: null };
    reportServerError("paciente.marcar-de-prueba-directo", e);
    return { error: "No se pudo marcarlo.", success: null, warning: null };
  }
}

/**
 * "ESTE SI ES REAL, aunque su profesional sea de prueba" (Santiago, 2026-10-01).
 *
 * LA SALIDA DE LA DERIVACION, Y SIN ESTA ACCION NO EXISTIA: la columna estaba en la base desde la 0202 y
 * ninguna pantalla podia escribirla, asi que la excepcion era teorica. Un mecanismo sin superficie que lo
 * alcance hace creer que una regla se puede aplicar cuando no.
 *
 * Y ES EL BOTON CORRECTO PARA UN DERIVADO: a un paciente derivado no se le puede "quitar la marca", porque
 * nadie se la puso; lo que se puede es decir que es real a pesar de su profesional.
 */
export async function confirmarPacienteRealAction(
  _prev: MarcaDePruebaState,
  form: FormData,
): Promise<MarcaDePruebaState> {
  const user = await requireUser();
  if (!canAccessAdmin(user)) {
    return { error: "Solo un administrador puede confirmarlo.", success: null, warning: null };
  }
  try {
    await confirmarPacienteReal({
      patientId: String(form.get("patientId") ?? ""),
      confirmar: String(form.get("confirmar") ?? "") === "true",
      actorId: user.id,
      actorEmail: user.email,
      ip: await getClientIp(),
    });
    return {
      error: null,
      warning: null,
      success:
        String(form.get("confirmar") ?? "") === "true"
          ? "Confirmado como real. Vuelve a contar en las cifras aunque su profesional sea de prueba."
          : "Quitada la confirmación. Vuelve a seguir la marca de su profesional.",
    };
  } catch (e) {
    if (e instanceof MarcaDePruebaError) return { error: e.message, success: null, warning: null };
    reportServerError("paciente.confirmar-real", e);
    return { error: "No se pudo confirmarlo.", success: null, warning: null };
  }
}
