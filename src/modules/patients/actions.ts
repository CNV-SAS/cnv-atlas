"use server";

import { getClientIp } from "@/core/http/client-ip";
import { limitDocumentLookupByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { buscarPorDocumento } from "./data/buscar-por-documento";
import { canCreatePatientPresencial } from "./policies/can-create-patient";
import { DOCUMENTO_AJENO } from "./text/documento-ajeno";
import type { VerificarDocumentoState } from "./types";
import { documentoSchema } from "./validations";

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
    return { ...vacio(DOCUMENTO_AJENO), ...eco, veredicto: "ajeno" };
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
