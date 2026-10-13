import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { presencialConsentSessions } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import { generateOpaqueToken } from "@/modules/evaluations/services/survey-link-service";

import {
  DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO_VERSION as VERSION_CON_ASENTIMIENTO,
  esDeclaracionDeMenor as esRamaDeMenor,
} from "../text/declaracion-presencial";

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

// DOS VENTANAS, no una, y cada una acota una cosa distinta:
//
//   · SESION_TTL_MIN acota el QR SIN ESCANEAR. Corta a proposito: un token visible en una pantalla no
//     debe vivir mucho rato.
//   · LECTURA_MIN acota a quien YA lo abrio en su telefono. Larga a proposito: quince minutos para leer
//     un consentimiento entero es poco, y castigar al que lee despacio es castigar exactamente la
//     conducta que hace informado al consentimiento. El que lee rapido pasaria y el que lee con calma
//     perderia el trabajo: el incentivo al reves.
export const SESION_TTL_MIN = 15;
export const LECTURA_MIN = 45;

export type SesionAbierta = {
  id: string;
  organizationId: string;
  professionalId: string;
  createdBy: string;
  estado: string;
};

// ── 1. EMITIR (pantalla del profesional, con sesion) ───────────────────────────────────────────────
/**
 * LOS ESTADOS QUE OCUPAN AL PROFESIONAL: mientras una sesion este en uno de estos, no se puede empezar
 * otra. La lista la comparten el BLOQUEO y la RECUPERACION a proposito: si bloquea, tiene que verse.
 */
export const ESTADOS_QUE_OCUPAN = ["emitida", "abierta", "confirmada", "discrepancia"] as const;

export async function crearSesionPresencial(input: {
  organizationId: string;
  professionalId: string;
  createdBy: string;
  documentType: string;
  documentNumber: string;
  /**
   * La fecha que el profesional leyo del documento. DECIDE LA RAMA DE EDAD (0216), asi que llega aqui y
   * no al final: la pantalla del paciente tiene que saber a quien pedirle los datos antes de que alguien
   * marque nada, y el profesional tiene que ver el texto de la declaracion que va a aceptar.
   */
  patientBirthDate: string;
  /** La que corresponde a esa fecha. Se fija una vez y es la que viaja a `patient_consents`. */
  declaracionVersion: string;
  ip: string | null;
}): Promise<{ token: string; id: string } | { yaHayUna: true; documento: string }> {
  const token = generateOpaqueToken();
  return db.transaction(async (tx) => {
    // LAS VENCIDAS DEJAN DE OCUPAR, y va ANTES del insert. Una sesion que nadie confirmo se queda en
    // 'emitida' para siempre; sin esto, la primera que venciera bloquearia al profesional de forma
    // PERMANENTE, que es peor que el problema que el indice unico cierra. No puede vivir en el indice
    // (una condicion con now() no es inmutable), asi que vive aqui.
    await tx
      .update(presencialConsentSessions)
      .set({ estado: "vencida" })
      .where(
        and(
          eq(presencialConsentSessions.professionalId, input.professionalId),
          inArray(presencialConsentSessions.estado, ["emitida", "abierta"]),
          sql`coalesce(${presencialConsentSessions.lecturaHasta}, ${presencialConsentSessions.expiresAt}) < now()`,
        ),
      );

    // ¿QUEDA ALGUNA VIVA? Se pregunta ANTES de insertar para poder decirlo con palabras y con el
    // documento concreto. El indice unico de la 0111 es el que de verdad lo impide; esto es para que el
    // profesional no descubra el limite con un error de base de datos.
    const [viva] = await tx
      .select({ documento: presencialConsentSessions.documentNumber })
      .from(presencialConsentSessions)
      .where(
        and(
          eq(presencialConsentSessions.professionalId, input.professionalId),
          inArray(presencialConsentSessions.estado, [...ESTADOS_QUE_OCUPAN]),
        ),
      )
      .limit(1);
    if (viva) return { yaHayUna: true as const, documento: viva.documento };

    const [fila] = await tx
      .insert(presencialConsentSessions)
      .values({
        token,
        organizationId: input.organizationId,
        professionalId: input.professionalId,
        createdBy: input.createdBy,
        documentType: input.documentType as never,
        documentNumber: input.documentNumber,
        patientBirthDate: input.patientBirthDate,
        declaracionVersion: input.declaracionVersion,
        // La IP de QUIEN EMITE, para poder contrastarla despues con la del paciente. No se compara aqui:
        // en este instante todavia no hay con que.
        professionalIp: input.ip,
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
      // LA VERSION DE LA DECLARACION VA EN EL AUDIT desde la emision: es lo que dice si este pase se
      // abrio como de mayor o de menor, y es la pregunta que alguien va a hacer meses despues. La FECHA
      // de nacimiento no va: es un dato del paciente y vive en la fila de la sesion, bajo RLS.
      payload: { professional_id: input.professionalId, declaracion_version: input.declaracionVersion },
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
      // GREATEST y no una asignacion directa: reabrir la sesion no puede ACORTARLE la ventana a nadie.
      lecturaHasta: sql`greatest(coalesce(${presencialConsentSessions.lecturaHasta}, now()), now() + interval '${sql.raw(String(LECTURA_MIN))} minutes')`,
      // LA MARCA DE MISMO ORIGEN se calcula AQUI, en el unico instante en que existen las dos IP, y con el
      // mismo `coalesce` que las demas: la del PRIMER acceso es la que vale. No bloquea nada (una clinica
      // con wifi las hace coincidir siempre); es una señal para que una persona la lea agregada.
      // DOS NULOS NO SON EL MISMO ORIGEN. `is not distinct from` los daria por iguales, y en desarrollo
      // (o detras de un proxy que no reenvie la IP) las dos son nulas: la sesion saldria marcada sin que
      // nadie haya compartido red. Sin las dos IP la marca queda NULA, que es lo que significa "no se
      // pudo saber", y es distinto de "no coincidieron".
      mismoOrigen: sql`coalesce(
        ${presencialConsentSessions.mismoOrigen},
        case
          when ${presencialConsentSessions.professionalIp} is null or ${input.ip}::inet is null then null
          else ${presencialConsentSessions.professionalIp} = ${input.ip}::inet
        end)`,
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
  | { estado: "no_disponible" }
  /** La rama de menor exige los datos del representante, y la 1.1-b ademas el asentimiento. */
  | { estado: "faltan_datos_del_representante" };

// ── 3. CONFIRMAR (el paciente escribio su identidad y marco; superficie publica) ───────────────────
export async function confirmarSesionPresencial(input: {
  token: string;
  nombres: string;
  apellidos: string;
  documentType: string;
  documentNumber: string;
  /** Lo que marco en SU dispositivo. Espera aqui hasta que el profesional declare. */
  autorizaciones: string[];
  /**
   * EN LA RAMA DE MENOR, quien autoriza es el representante legal, y escribe LO SUYO aqui (0216). El
   * correo es opcional: en el presencial no hay codigo que mandar, y esta via existe porque no hay correo.
   */
  representante?: {
    nombre: string;
    documento: string;
    parentesco: string;
    email: string | null;
  };
  /** El asentimiento del menor de 14 a 17. Solo tiene sentido en la 1.1-b. */
  asentimientoMenor?: boolean;
}): Promise<ResultadoConfirmacion> {
  return db.transaction(async (tx) => {
    const [fila] = await tx
      .select({
        id: presencialConsentSessions.id,
        documentType: presencialConsentSessions.documentType,
        documentNumber: presencialConsentSessions.documentNumber,
        createdBy: presencialConsentSessions.createdBy,
        declaracionVersion: presencialConsentSessions.declaracionVersion,
      })
      .from(presencialConsentSessions)
      .where(
        and(
          eq(presencialConsentSessions.token, input.token),
          isNull(presencialConsentSessions.confirmedAt),
          // LA VENTANA DE LECTURA, no la del QR: quien ya abrio tiene su tiempo para leer. Si nunca
          // abrio, `lectura_hasta` es nulo y cae a la ventana corta, que es la correcta para un token
          // que sigue en pantalla sin escanear.
          sql`coalesce(${presencialConsentSessions.lecturaHasta}, ${presencialConsentSessions.expiresAt}) > now()`,
        ),
      );
    if (!fila) return { estado: "no_disponible" };

    // ═══ LA RAMA LA DECIDE LA SESION, NO EL FORMULARIO (0216) ═══
    //
    // La version se fijo al emitir el pase, a partir de la fecha que el profesional leyo del documento.
    // Asi que lo que llegue del telefono no puede cambiar de rama: se comprueba CONTRA la sesion.
    //
    // POR QUE SE COMPRUEBA AQUI Y TAMBIEN EN LA BASE: el CHECK de la 0216 es la defensa de fondo y lanza,
    // que desde una superficie publica es un 500 para el representante. Esto devuelve un desenlace que la
    // pantalla sabe decir con palabras.
    const esMenor = esRamaDeMenor(fila.declaracionVersion);
    const r = input.representante;
    if (esMenor) {
      if (!r || !r.nombre.trim() || !r.documento.trim() || !r.parentesco.trim()) {
        return { estado: "faltan_datos_del_representante" };
      }
      if (
        fila.declaracionVersion === VERSION_CON_ASENTIMIENTO &&
        input.asentimientoMenor !== true
      ) {
        return { estado: "faltan_datos_del_representante" };
      }
    }
    // Y EN LA RAMA MAYOR NO SE GUARDA REPRESENTANTE aunque alguien lo mande: ahi la declaracion 1.0
    // afirma que marco el PACIENTE, y un representante colgando de esa fila la contradice.
    const representante = esMenor && r ? r : null;

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
        declaradoAutorizaciones: input.autorizaciones,
        representanteNombre: representante?.nombre.trim() ?? null,
        representanteDocumento: representante?.documento.trim() ?? null,
        representanteParentesco: representante?.parentesco.trim() ?? null,
        representanteEmail: representante?.email?.trim() || null,
        asentimientoMenor: esMenor ? input.asentimientoMenor === true : null,
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
      //
      // SI QUIEN AUTORIZO FUE UN REPRESENTANTE, eso SI va: es un hecho sobre el acto, no un dato de nadie,
      // y es la primera pregunta de cualquiera que revise un consentimiento de un menor.
      payload: { coincide, rama: esMenor ? "menor" : "mayor" },
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
  // ── LA RAMA DE EDAD DE ESTE PASE (0216) ──────────────────────────────────────────────────────────
  //
  // Viaja a la pantalla del profesional porque es ella la que tiene que mostrarle EL TEXTO QUE VA A
  // ACEPTAR, y ese texto depende de la edad. Derivarlo en la pantalla seria tener dos sitios que eligen
  // la declaracion, y el dia que discrepen el profesional aceptaria un texto y se guardaria otro.
  declaracionVersion: string;
  /** La que se leyo del documento al emitir. Se muestra en solo lectura: aqui ya no se escribe. */
  patientBirthDate: string | null;
  /** Quien autorizo, en la rama de menor. null en la rama mayor (ahi autoriza el paciente). */
  representante: { nombre: string; documento: string; parentesco: string; email: string | null } | null;
  asentimientoMenor: boolean | null;
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
      "id, estado, opened_at, confirmed_at, declarado_nombres, declarado_apellidos, declarado_document_number, declaracion_version, patient_birth_date, representante_nombre, representante_documento, representante_parentesco, representante_email, asentimiento_menor",
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
    declaracionVersion: data.declaracion_version,
    patientBirthDate: data.patient_birth_date,
    representante: data.representante_nombre
      ? {
          nombre: data.representante_nombre,
          documento: data.representante_documento ?? "",
          parentesco: data.representante_parentesco ?? "",
          email: data.representante_email,
        }
      : null,
    asentimientoMenor: data.asentimiento_menor,
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

// ── LECTURA SIN EFECTOS, para pintar la pagina publica ────────────────────────────────────────────
//
// La pagina NO puede sellar la apertura: un componente de servidor se re-renderiza y el sello tiene que
// ocurrir UNA vez, cuando el paciente de verdad la abre en su telefono. Por eso se parte: la pagina LEE
// (esto) y el cliente SELLA al montarse (`abrirSesionQrAction`). Devuelve lo justo para pintar el
// documento de consentimiento, que necesita saber de que profesional es.
export async function resolverSesionPorToken(token: string): Promise<{
  professionalId: string;
  estado: string;
  vigente: boolean;
  /**
   * LA RAMA DE EDAD, para que la pantalla del paciente sepa a quien le esta hablando (0216). Es lo UNICO
   * de la rama que viaja a una superficie publica: ni la fecha de nacimiento ni el documento, que son
   * datos del paciente y no hacen falta para pintar la pagina.
   */
  esDeMenor: boolean;
  /** Si hay que pedir el asentimiento del menor (14 a 17). Solo en la 1.1-b. */
  pideAsentimiento: boolean;
} | null> {
  if (!token) return null;
  const [fila] = await db
    .select({
      professionalId: presencialConsentSessions.professionalId,
      estado: presencialConsentSessions.estado,
      expiresAt: presencialConsentSessions.expiresAt,
      lecturaHasta: presencialConsentSessions.lecturaHasta,
      confirmedAt: presencialConsentSessions.confirmedAt,
      declaracionVersion: presencialConsentSessions.declaracionVersion,
    })
    .from(presencialConsentSessions)
    .where(eq(presencialConsentSessions.token, token));
  if (!fila) return null;
  const limite = fila.lecturaHasta ?? fila.expiresAt;
  return {
    professionalId: fila.professionalId,
    estado: fila.estado,
    vigente: fila.confirmedAt === null && limite.getTime() > Date.now(),
    esDeMenor: esRamaDeMenor(fila.declaracionVersion),
    pideAsentimiento: fila.declaracionVersion === VERSION_CON_ASENTIMIENTO,
  };
}

// ── LA SESION EN CURSO DEL PROFESIONAL, para sobrevivir a una recarga ─────────────────────────────
//
// EL DEFECTO QUE CIERRA: el id de la sesion vivia SOLO en el estado del componente. Una recarga (o un
// toque accidental) lo borraba, y la pantalla volvia al principio a pedir un documento. Con el paciente
// ya confirmado, eso significa perder un consentimiento que YA se dio y tener que repetirlo con la
// persona delante, que es lo peor que puede pasar en esta pieza.
//
// SE RECUPERA DEL SERVIDOR, que es donde el acto de verdad ocurrio. Por RLS: solo salen las suyas.
//
// LA MAS RECIENTE NO TERMINAL: `declarada`, `abandonada` y `vencida` ya no tienen nada pendiente, y
// `discrepancia` SI la tiene (hay que resolverla con el paciente), asi que cuenta como en curso.
export async function sesionEnCursoDelProfesional(): Promise<EstadoSesion | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("presencial_consent_sessions")
    .select(
      "id, estado, opened_at, confirmed_at, declarado_nombres, declarado_apellidos, declarado_document_number, declaracion_version, patient_birth_date, representante_nombre, representante_documento, representante_parentesco, representante_email, asentimiento_menor",
    )
    // MISMA LISTA QUE EL BLOQUEO, y SIN filtro de tiempo: ver el bloque de arriba. El filtro por
    // `lectura_hasta` dejaba invisibles justo las que no se vencen solas (confirmada y discrepancia),
    // que son las que de verdad encierran al profesional.
    .in("estado", [...ESTADOS_QUE_OCUPAN])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`sesion-presencial: en curso: ${error.message}`);
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
    declaracionVersion: data.declaracion_version,
    patientBirthDate: data.patient_birth_date,
    representante: data.representante_nombre
      ? {
          nombre: data.representante_nombre,
          documento: data.representante_documento ?? "",
          parentesco: data.representante_parentesco ?? "",
          email: data.representante_email,
        }
      : null,
    asentimientoMenor: data.asentimiento_menor,
  };
}

// ── LO QUE HACE FALTA PARA DECLARAR ───────────────────────────────────────────────────────────────
//
// Se relee EN SERVIDOR y POR RLS: lo que traiga el formulario del profesional no gobierna nada. Devuelve
// lo que el PACIENTE escribio (que es lo que va a ser su identidad) y lo que marco.
export type SesionParaDeclarar = {
  estado: string;
  declaradoNombres: string | null;
  declaradoApellidos: string | null;
  declaradoDocumentType: string | null;
  declaradoDocumentNumber: string | null;
  autorizaciones: string[] | null;
  /**
   * LA FECHA Y LA VERSION SALEN DE AQUI, no del formulario del profesional (0216). La fecha se escribio al
   * emitir el pase, con el documento delante, y es la que decidio que declaracion se le mostro. Volver a
   * pedirla al declarar abriria la puerta a que el texto aceptado y la edad guardada no correspondan.
   */
  patientBirthDate: string | null;
  declaracionVersion: string;
  representante: {
    nombre: string;
    documento: string;
    parentesco: string;
    email: string | null;
  } | null;
  asentimientoMenor: boolean | null;
};

export async function leerSesionParaDeclarar(sessionId: string): Promise<SesionParaDeclarar | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("presencial_consent_sessions")
    .select(
      "estado, declarado_nombres, declarado_apellidos, declarado_document_type, declarado_document_number, declarado_autorizaciones, patient_birth_date, declaracion_version, representante_nombre, representante_documento, representante_parentesco, representante_email, asentimiento_menor",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`sesion-presencial: para declarar: ${error.message}`);
  if (!data) return null;
  return {
    estado: data.estado,
    declaradoNombres: data.declarado_nombres,
    declaradoApellidos: data.declarado_apellidos,
    declaradoDocumentType: data.declarado_document_type,
    declaradoDocumentNumber: data.declarado_document_number,
    autorizaciones: (data.declarado_autorizaciones as string[] | null) ?? null,
    patientBirthDate: data.patient_birth_date,
    declaracionVersion: data.declaracion_version,
    representante: data.representante_nombre
      ? {
          nombre: data.representante_nombre,
          documento: data.representante_documento ?? "",
          parentesco: data.representante_parentesco ?? "",
          email: data.representante_email,
        }
      : null,
    asentimientoMenor: data.asentimiento_menor,
  };
}
