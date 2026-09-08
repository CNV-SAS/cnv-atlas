import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { presencialConsentSessions } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import { generateOpaqueToken } from "@/modules/evaluations/services/survey-link-service";

// LA SESION DE CONSENTIMIENTO PRESENCIAL · MODALIDAD 2 (QR), dictamen 2026-09-09.
//
// LO QUE ESTA MODALIDAD ES Y LO QUE NO, repetido aqui porque es el modulo que la gobierna: produce una
// AUTORIZACION VALIDA, NO una firma electronica con presuncion de confiabilidad. Si alguien la discute,
// la carga de probar recae en NOSOTROS, y lo unico que se puede aportar es lo que esta tabla guarda.
//
// LOS CUATRO REGISTROS QUE EL DICTAMEN EXIGE, y por que cada uno:
//   · la SESION ata el acto a esa consulta;
//   · lo que el paciente escribio EN SU DISPOSITIVO, tal cual, porque es lo que convierte el acto en una
//     manifestacion suya y no en la aceptacion de datos que otro registro;
//   · DOS marcas de tiempo, porque "un consentimiento aceptado cuatro segundos despues de abrirse es
//     dificil de defender como informado": lo que prueba algo es la DISTANCIA, no el instante;
//   · IP y agente del dispositivo del paciente, porque "sin eso, la afirmacion de que fueron dispositivos
//     distintos es solo una etiqueta que puso el sistema".

/** Quince minutos: la sesion existe mientras dura la consulta, no mas. */
export const SESION_TTL_MIN = 15;

export type SesionAbierta = {
  id: string;
  organizationId: string;
  professionalId: string;
  createdBy: string;
  estado: string;
};

// ── 1. EMITIR (pantalla del profesional, con sesion) ───────────────────────────────────────────────
export async function crearSesionPresencial(input: {
  organizationId: string;
  professionalId: string;
  createdBy: string;
  documentType: string;
  documentNumber: string;
  declaracionVersion: string;
  ip: string | null;
}): Promise<{ token: string; id: string }> {
  const token = generateOpaqueToken();
  return db.transaction(async (tx) => {
    const [fila] = await tx
      .insert(presencialConsentSessions)
      .values({
        token,
        organizationId: input.organizationId,
        professionalId: input.professionalId,
        createdBy: input.createdBy,
        documentType: input.documentType as never,
        documentNumber: input.documentNumber,
        declaracionVersion: input.declaracionVersion,
        expiresAt: new Date(Date.now() + SESION_TTL_MIN * 60_000),
      })
      .returning({ id: presencialConsentSessions.id });

    // EL INTENTO QUEDA REGISTRADO DESDE QUE SE ABRE, y esto corrige nuestra lectura anterior: creiamos
    // que registrar un intento abandonado era guardar datos del paciente, y no lo es. Aqui no va nombre,
    // ni documento, ni respuestas: solo la sesion, el profesional y el instante.
    //
    // SIRVE PARA DOS COSAS, y la segunda es la que importa: usabilidad (saber cuantos se quedan a medias)
    // y VIGILANCIA sobre la modalidad mas fragil (un profesional que abra el flujo sin el paciente
    // delante deja una fila de sesiones emitidas que nadie abrio nunca).
    await recordAudit(tx, {
      event: "presencial.session_created",
      actorId: input.createdBy,
      actorEmail: null,
      entityType: "presencial_session",
      entityId: fila.id,
      payload: { professional_id: input.professionalId },
      ip: input.ip,
    });
    return { token, id: fila.id };
  });
}

// ── 2. ABRIR (el paciente escanea; superficie publica, sin sesion) ─────────────────────────────────
//
// Sella `opened_at` y el DISPOSITIVO. Solo la primera vez: si el paciente recarga, la marca original se
// conserva, porque es la que sostiene la distancia hasta la confirmacion.
export async function abrirSesionPresencial(input: {
  token: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<SesionAbierta | null> {
  const [fila] = await db
    .update(presencialConsentSessions)
    .set({
      estado: sql`case when ${presencialConsentSessions.estado} = 'emitida' then 'abierta' else ${presencialConsentSessions.estado} end`,
      openedAt: sql`coalesce(${presencialConsentSessions.openedAt}, now())`,
      patientIp: sql`coalesce(${presencialConsentSessions.patientIp}, ${input.ip}::inet)`,
      patientUserAgent: sql`coalesce(${presencialConsentSessions.patientUserAgent}, ${input.userAgent})`,
    })
    .where(
      and(
        eq(presencialConsentSessions.token, input.token),
        isNull(presencialConsentSessions.confirmedAt),
        sql`${presencialConsentSessions.expiresAt} > now()`,
        sql`${presencialConsentSessions.estado} in ('emitida','abierta','discrepancia')`,
      ),
    )
    .returning({
      id: presencialConsentSessions.id,
      organizationId: presencialConsentSessions.organizationId,
      professionalId: presencialConsentSessions.professionalId,
      createdBy: presencialConsentSessions.createdBy,
      estado: presencialConsentSessions.estado,
    });
  return fila ?? null;
}

export type ResultadoConfirmacion =
  | { estado: "confirmada"; id: string }
  | { estado: "discrepancia" }
  | { estado: "no_disponible" };

// ── 3. CONFIRMAR (el paciente escribio su identidad y marco; superficie publica) ───────────────────
export async function confirmarSesionPresencial(input: {
  token: string;
  nombres: string;
  apellidos: string;
  documentType: string;
  documentNumber: string;
}): Promise<ResultadoConfirmacion> {
  return db.transaction(async (tx) => {
    const [fila] = await tx
      .select({
        id: presencialConsentSessions.id,
        documentType: presencialConsentSessions.documentType,
        documentNumber: presencialConsentSessions.documentNumber,
        createdBy: presencialConsentSessions.createdBy,
      })
      .from(presencialConsentSessions)
      .where(
        and(
          eq(presencialConsentSessions.token, input.token),
          isNull(presencialConsentSessions.confirmedAt),
          sql`${presencialConsentSessions.expiresAt} > now()`,
        ),
      );
    if (!fila) return { estado: "no_disponible" };

    // LA DISCREPANCIA SE PARA, NO SE RESUELVE SOLA. Ni se pisa lo que escribio el paciente ni lo que
    // escribio el profesional: son dos afirmaciones y la contradiccion es informacion, no ruido. Lo
    // resuelven los dos, que estan en la misma sala. Elegir automaticamente uno de los dos seria decidir
    // por ellos justo en el dato que identifica a la persona.
    const coincide =
      normalizar(fila.documentNumber) === normalizar(input.documentNumber) &&
      fila.documentType === input.documentType;

    await tx
      .update(presencialConsentSessions)
      .set({
        declaradoNombres: input.nombres,
        declaradoApellidos: input.apellidos,
        declaradoDocumentType: input.documentType as never,
        declaradoDocumentNumber: input.documentNumber,
        ...(coincide
          ? { estado: "confirmada", confirmedAt: sql`now()` }
          : { estado: "discrepancia" }),
      })
      .where(eq(presencialConsentSessions.id, fila.id));

    await recordAudit(tx, {
      event: coincide ? "presencial.session_confirmed" : "presencial.session_mismatch",
      actorId: null,
      actorEmail: null,
      entityType: "presencial_session",
      entityId: fila.id,
      // SIN DOCUMENTO NI NOMBRE en el audit: el registro del intento dice QUE paso, no QUIEN. Los datos
      // declarados viven en la fila de la sesion, que es efimera y esta bajo RLS del profesional.
      payload: { coincide },
    });

    return coincide ? { estado: "confirmada", id: fila.id } : { estado: "discrepancia" };
  });
}

// Documento: se comparan los digitos, no el formato. Un paciente que escribe puntos o espacios no esta
// declarando otro documento, y tratarlo como discrepancia mandaria a los dos a resolver un problema que
// no existe. La comparacion sigue siendo EXACTA sobre el numero.
function normalizar(documento: string): string {
  return documento.replace(/[\s.-]/g, "").toUpperCase();
}

// ── 4. LO QUE VE EL PROFESIONAL MIENTRAS ESPERA ───────────────────────────────────────────────────
//
// Va por RLS (la policy `presencial_sessions_select` usa `es_mi_ficha_profesional`), asi que un
// profesional no puede mirar la sesion de otro.
export type EstadoSesion = {
  id: string;
  estado: string;
  openedAt: string | null;
  confirmedAt: string | null;
  /** Segundos entre abrir y confirmar. null si aun no confirmo. Es la cifra que el dictamen pide mirar. */
  segundosDeLectura: number | null;
  declaradoNombres: string | null;
  declaradoApellidos: string | null;
  declaradoDocumentNumber: string | null;
};

export async function leerEstadoSesion(sessionId: string): Promise<EstadoSesion | null> {
  // POR RLS DE VERDAD, no por la conexion directa. `db` es la conexion de servicio y SALTA la RLS: si el
  // lector fuera por ahi, un profesional podria leer la sesion de otro y el comentario que dice "va por
  // RLS" seria falso. Con el cliente de sesion, la policy `presencial_sessions_select`
  // (`es_mi_ficha_profesional`) decide, y si no es suya no sale nada.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("presencial_consent_sessions")
    .select(
      "id, estado, opened_at, confirmed_at, declarado_nombres, declarado_apellidos, declarado_document_number",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`sesion-presencial: ${error.message}`);
  if (!data) return null;
  const abierta = data.opened_at ? new Date(data.opened_at).getTime() : null;
  const confirmada = data.confirmed_at ? new Date(data.confirmed_at).getTime() : null;
  return {
    id: data.id,
    estado: data.estado,
    openedAt: data.opened_at,
    confirmedAt: data.confirmed_at,
    segundosDeLectura:
      abierta !== null && confirmada !== null ? Math.round((confirmada - abierta) / 1000) : null,
    declaradoNombres: data.declarado_nombres,
    declaradoApellidos: data.declarado_apellidos,
    declaradoDocumentNumber: data.declarado_document_number,
  };
}

/** Cierra la sesion cuando el profesional desiste. Desenlace normal, no fallo. */
export async function abandonarSesion(sessionId: string, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(presencialConsentSessions)
      .set({ estado: "abandonada" })
      .where(
        and(
          eq(presencialConsentSessions.id, sessionId),
          isNull(presencialConsentSessions.declaredAt),
        ),
      );
    await recordAudit(tx, {
      event: "presencial.session_abandoned",
      actorId,
      actorEmail: null,
      entityType: "presencial_session",
      entityId: sessionId,
    });
  });
}
