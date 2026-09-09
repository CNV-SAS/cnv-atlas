"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";
import { canCreatePatientPresencial } from "@/modules/patients/policies/can-create-patient";

import {
  abandonarSesion,
  abrirSesionPresencial,
  confirmarSesionPresencial,
  crearSesionPresencial,
  leerEstadoSesion,
  leerSesionParaDeclarar,
  sesionEnCursoDelProfesional,
  type EstadoSesion,
} from "./data/sesion-presencial";
import { DECLARACION_PRESENCIAL_VERSION } from "./text/declaracion-presencial";

// ACCIONES DE LA MODALIDAD 2 (QR). Dos superficies muy distintas conviven aqui:
//
//   · las del PROFESIONAL exigen sesion y su policy;
//   · las del PACIENTE no tienen sesion: se autentican con el token del QR, que es de un solo uso, vive
//     poco y solo existio en la pantalla de esa consulta.
//
// Estan en el mismo archivo a proposito, para que la asimetria se vea de un vistazo y nadie añada una del
// paciente copiando la guarda de las del profesional (o al reves, que es peor).

export type SesionQrState = {
  error: string | null;
  token: string | null;
  sessionId: string | null;
};

// ── PROFESIONAL: emitir el QR ─────────────────────────────────────────────────────────────────────
export async function emitirSesionQrAction(
  _prev: SesionQrState,
  form: FormData,
): Promise<SesionQrState> {
  const fail = (error: string): SesionQrState => ({ error, token: null, sessionId: null });
  const user = await requireUser();
  if (!canCreatePatientPresencial(user)) return fail("No autorizado.");

  const { getProfessionalProfileIdByUser } = await import(
    "@/modules/payments/data/payments-repository"
  );
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) return fail("Tu cuenta no tiene un perfil profesional.");

  const documentType = String(form.get("documentType") ?? "").trim();
  const documentNumber = String(form.get("documentNumber") ?? "").trim();
  if (!documentType || documentNumber.length < 3) return fail("Falta el documento verificado.");

  const ip = await getClientIp();
  const s = await crearSesionPresencial({
    organizationId: user.organizationId,
    professionalId,
    createdBy: user.id,
    documentType,
    documentNumber,
    declaracionVersion: DECLARACION_PRESENCIAL_VERSION,
    ip: ip === "unknown" ? null : ip,
  });
  return { error: null, token: s.token, sessionId: s.id };
}

// ── PROFESIONAL: mirar si el paciente ya termino ──────────────────────────────────────────────────
//
// SONDEO Y NO TIEMPO REAL, y es una decision, no una limitacion: el evento que se espera ocurre UNA vez
// por consulta y la pantalla ya esta abierta delante de una persona. Una suscripcion en vivo (Realtime)
// traeria una dependencia nueva, una conexion que mantener y un modo de fallo silencioso (se cae y la
// pantalla se queda muda para siempre) a cambio de ahorrar unos segundos.
//
// El sondeo falla RUIDOSO: si no responde, la pantalla lo dice. Y se DETIENE solo (ver el componente):
// en cuanto el estado es terminal o la ventana de lectura vencio, deja de preguntar. Una pantalla que
// sondea para siempre porque el paciente se fue es el defecto que hay que evitar, no la latencia.
export async function estadoSesionQrAction(sessionId: string): Promise<EstadoSesion | null> {
  const user = await requireUser();
  if (!canCreatePatientPresencial(user)) return null;
  // La lectura va por RLS: si la sesion no es suya, no sale nada.
  return leerEstadoSesion(sessionId);
}

// RECUPERA la sesion en curso tras una recarga. Sin esto, el profesional que recarga pierde de vista un
// consentimiento YA confirmado y tendria que repetirlo con el paciente delante.
export async function sesionEnCursoAction(): Promise<EstadoSesion | null> {
  const user = await requireUser();
  if (!canCreatePatientPresencial(user)) return null;
  return sesionEnCursoDelProfesional();
}

export async function abandonarSesionQrAction(sessionId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!canCreatePatientPresencial(user)) return { error: "No autorizado." };
  await abandonarSesion(sessionId, user.id);
  return { error: null };
}

// ── PACIENTE: abrir el QR en su telefono ──────────────────────────────────────────────────────────
//
// Sin sesion. Se llama desde la pagina publica al montarse, y es lo que sella la primera marca de tiempo
// y el dispositivo. Devuelve solo si la sesion sirve: nada del paciente ni del profesional.
export async function abrirSesionQrAction(token: string): Promise<{ ok: boolean }> {
  try {
    const h = await headers();
    const ip = await getClientIp();
    const abierta = await abrirSesionPresencial({
      token,
      ip: ip === "unknown" ? null : ip,
      userAgent: h.get("user-agent"),
    });
    return { ok: abierta !== null };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "sesion-qr", op: "abrir" } });
    return { ok: false };
  }
}

export type ConfirmacionQrState = {
  error: string | null;
  estado: "pendiente" | "confirmada" | "discrepancia" | "no_disponible";
  /** En discrepancia, lo que el paciente escribio. Lo del profesional NO viaja aqui (ver abajo). */
  declarado: string | null;
};

// ── PACIENTE: escribir su identidad y confirmar ───────────────────────────────────────────────────
export async function confirmarSesionQrAction(
  _prev: ConfirmacionQrState,
  form: FormData,
): Promise<ConfirmacionQrState> {
  const s = (n: string) => String(form.get(n) ?? "").trim();
  const token = s("token");
  const nombres = s("firstName");
  const apellidos = s("lastName");
  const documentNumber = s("documentNumber");
  const documentType = s("documentType");
  if (!token || !nombres || !apellidos || documentNumber.length < 3 || !documentType) {
    return { error: "Completa tu nombre y tu documento.", estado: "pendiente", declarado: null };
  }

  // Las tres necesarias tienen que estar marcadas para poder continuar. Es el mismo gate del camino
  // normal: sin ellas no hay autorizacion que otorgar.
  const marcada = (n: string) => form.get(n) === "on";
  if (!marcada("servicio") || !marcada("datos_sensibles") || !marcada("aceptacion_medio_electronico")) {
    return {
      error: "Marca las tres autorizaciones necesarias para continuar.",
      estado: "pendiente",
      declarado: null,
    };
  }
  const autorizaciones = [
    "servicio",
    "datos_sensibles",
    "aceptacion_medio_electronico",
    ...(["investigacion", "comunicaciones_continuidad", "comunicaciones_comerciales"] as const).filter(
      marcada,
    ),
  ];

  const r = await confirmarSesionPresencial({
    token,
    nombres,
    apellidos,
    documentType,
    documentNumber,
    autorizaciones,
  });

  if (r.estado === "no_disponible") {
    return {
      error:
        "Este código ya no está disponible: se usó o venció. Pídele a tu profesional que te muestre uno nuevo.",
      estado: "no_disponible",
      declarado: null,
    };
  }
  if (r.estado === "discrepancia") {
    // LO QUE NO SE HACE AQUI: enseñarle al paciente el documento que escribio el profesional. Seria
    // decirle la respuesta, y entonces "coinciden" dejaria de significar nada: bastaria con copiarla. La
    // pantalla dice QUE no coincide y los manda a mirarlo juntos con la cedula delante.
    return {
      error: null,
      estado: "discrepancia",
      declarado: `${documentType} ${documentNumber}`,
    };
  }
  return { error: null, estado: "confirmada", declarado: null };
}

export type DeclararQrState = {
  error: string | null;
  resumeToken: string | null;
};

// ── PROFESIONAL: DECLARAR Y CREAR (el paso final de la modalidad 2) ───────────────────────────────
//
// VA DESPUES DE QUE EL PACIENTE CONFIRME, y no antes, porque la declaracion afirma lo que YA ocurrio:
// que se le presento el consentimiento, que tuvo oportunidad de leerlo, que fue EL quien marco, y que se
// verifico su identidad contra el documento. Marcarla antes seria una promesa, no una declaracion.
//
// LA IDENTIDAD SE ARMA DE DOS FUENTES, y cada una aporta lo que le toca:
//   · NOMBRE Y DOCUMENTO salen de lo que el PACIENTE escribio en su telefono. Es su manifestacion, y es
//     lo que el dictamen pide que sea suyo. No se sobrescribe con lo que escribio el profesional.
//   · FECHA, SEXO, PAIS Y CIUDAD salen de la pantalla del profesional, que ya los tenia. Pedirselos al
//     paciente en su telefono alargaria el acto sin añadir nada a lo que se esta probando.
//
// Y NO HAY COPIA POR CORREO, a diferencia del camino normal: esta modalidad existe precisamente porque el
// paciente no tiene correo. La constancia que se lleva es la que su profesional le entregue.
export async function declararYCrearQrAction(
  _prev: DeclararQrState,
  form: FormData,
): Promise<DeclararQrState> {
  const fail = (error: string): DeclararQrState => ({ error, resumeToken: null });
  const user = await requireUser();
  if (!canCreatePatientPresencial(user)) return fail("No autorizado.");

  const s = (n: string) => String(form.get(n) ?? "").trim();
  const sessionId = s("sessionId");
  if (!sessionId) return fail("Falta la sesión.");
  if (form.get("declaracion") !== "on") {
    return fail("Marca la declaración para poder crear el paciente.");
  }

  const { getProfessionalProfileIdByUser } = await import(
    "@/modules/payments/data/payments-repository"
  );
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) return fail("Tu cuenta no tiene un perfil profesional.");

  // LA SESION SE RELEE EN SERVIDOR, por RLS: lo que traiga el formulario no gobierna. Y tiene que estar
  // CONFIRMADA: declarar sobre una que el paciente no confirmo seria afirmar un acto que no ocurrio.
  const sesion = await leerSesionParaDeclarar(sessionId);
  if (!sesion) return fail("Esa sesión ya no está disponible.");
  if (sesion.estado !== "confirmada") {
    return fail("El paciente todavía no ha confirmado su autorización.");
  }

  const ip = await getClientIp();
  const { signIntakeEvaluation, ConsentGateError } = await import(
    "@/modules/evaluations/data/intake-writer"
  );
  const { CONSENT_DOCUMENT_HASH, CONSENT_VERSION } = await import("@/modules/consent/consent-hash");

  try {
    const r = await signIntakeEvaluation({
      organizationId: user.organizationId,
      professionalId,
      mode: "inicial",
      patientId: null,
      identity: {
        // Del PACIENTE, tal como lo escribio en su telefono.
        documentType: sesion.declaradoDocumentType as never,
        documentNumber: sesion.declaradoDocumentNumber ?? "",
        firstName: sesion.declaradoNombres ?? "",
        lastName: sesion.declaradoApellidos ?? "",
        // Del profesional, que ya los tenia.
        birthDate: s("birthDate") || null,
        sex: s("sex"),
        country: s("country") || null,
        city: s("city") || null,
        email: null,
        phone: s("phone") || null,
      },
      consents: (sesion.autorizaciones ?? []).map((type) => ({
        type: type as never,
        consentVersion: CONSENT_VERSION,
        documentHash: CONSENT_DOCUMENT_HASH,
      })),
      linkId: null,
      ipAddress: ip === "unknown" ? null : ip,
      presencial: {
        canal: "presencial_qr",
        // LA PERSONA, no su ficha profesional: `declared_by` referencia `profiles(id)`. Pasar aqui el
        // `professional_profiles.id` (que esta a mano, dos lineas arriba) es el defecto que ya rompio un
        // smoke entero, y compila igual de verde porque los dos son uuid.
        declaradoPorProfileId: user.id,
        declaracionVersion: DECLARACION_PRESENCIAL_VERSION,
        // La sesion se cierra dentro de la MISMA transaccion que crea al paciente.
        sessionId,
      },
    });
    revalidatePath("/pacientes");
    return { error: null, resumeToken: r.resumeToken };
  } catch (e) {
    if (e instanceof ConsentGateError) {
      return fail("Faltan autorizaciones necesarias: no se puede crear la evaluación.");
    }
    // El documento pudo dejar de estar libre entre la verificacion y ahora (otro profesional lo creo en
    // ese rato). El unique de la base lo impide; aqui se dice con palabras.
    if (String((e as { message?: string }).message ?? "").includes("patients_org_document_unique")) {
      return fail("Ese documento ya está registrado. Verifícalo de nuevo antes de continuar.");
    }
    Sentry.captureException(e, { tags: { area: "sesion-qr", op: "declarar" } });
    return fail("No pudimos crear el paciente en este momento. Intenta de nuevo.");
  }
}
