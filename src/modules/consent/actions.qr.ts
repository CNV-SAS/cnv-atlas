"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";

import { getClientIp } from "@/core/http/client-ip";
import { qrDelLink } from "@/modules/payments/services/qr-del-link";
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
import { computeAgeYears } from "./validations";
import {
  declaracionAfirmaAsentimiento,
  declaracionPorEdad,
  esDeclaracionDeMenor,
} from "./text/declaracion-presencial";

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
  /** El QR del enlace, como imagen `data:`. null si falta la URL de la app: el pase sale igual. */
  qrDataUrl: string | null;
};

// ── PROFESIONAL: emitir el QR ─────────────────────────────────────────────────────────────────────
export async function emitirSesionQrAction(
  _prev: SesionQrState,
  form: FormData,
): Promise<SesionQrState> {
  const fail = (error: string): SesionQrState => ({ error, token: null, sessionId: null, qrDataUrl: null });
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

  // ═══ LA FECHA DE NACIMIENTO SE EXIGE AL EMITIR EL PASE (0216) ═══
  //
  // Y NO AL DECLARAR, QUE ES DONDE ESTABA. La fecha decide la rama de edad, y de la rama dependen dos
  // cosas que ocurren ANTES de declarar: a quien le pide los datos la pantalla del paciente (para un
  // menor, al representante legal) y cual de los tres textos de declaracion se le muestra al profesional.
  //
  // CON LA FECHA AL FINAL, un menor completaba el acto entero en su telefono para que el guard del
  // escritor lo frenara despues, con un mensaje que lo mandaba a otro camino. Un guard correcto mal
  // expuesto, y encima con el trabajo ya hecho.
  //
  // SE EXIGE EN EL SERVIDOR y no solo con el `required` del campo: el `required` lo comprueba el
  // navegador, y es textual del dictamen que *"este hueco existio porque el formulario permitio guardar
  // un estado imposible, y mientras eso siga siendo posible va a volver a ocurrir POR OTRA VIA"*.
  const birthDate = String(form.get("birthDate") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return fail(
      "Escribe la fecha de nacimiento del documento. Es lo que decide si autoriza el paciente o su representante legal.",
    );
  }
  const edad = computeAgeYears(birthDate, new Date());
  const declaracion = declaracionPorEdad(edad);
  if (!declaracion) {
    return fail("Esa fecha de nacimiento no es válida: revísala en el documento.");
  }

  const ip = await getClientIp();
  const s = await crearSesionPresencial({
    organizationId: user.organizationId,
    professionalId,
    createdBy: user.id,
    documentType,
    documentNumber,
    patientBirthDate: birthDate,
    // LA VERSION SE FIJA AQUI, una sola vez, y es la que viaja a `patient_consents` al declarar. Si se
    // volviera a calcular al declarar habria dos sitios que la eligen, y el dia que discreparan el
    // profesional aceptaria un texto y se guardaria otro.
    declaracionVersion: declaracion.version,
    ip: ip === "unknown" ? null : ip,
  });
  if ("yaHayUna" in s) {
    // EL LIMITE, DICHO CON PALABRAS y con el documento concreto, en vez de un error de base de datos. Y
    // con la salida: anular siempre es posible mientras no se haya declarado, asi que nadie queda
    // bloqueado.
    // EL AVISO DICE DONDE, no solo que (2026-09-19). Decia "Termínalo o anúlalo" sin decir desde donde,
    // y el bloque que lo permite estaba arriba en la misma pantalla: el profesional leia una instruccion
    // sin sitio donde cumplirla.
    return fail(
      `Ya tienes un pase en curso con el documento ${s.documento}. Arriba, en "Tienes un pase en curso", ` +
        "puedes terminarlo o anularlo para empezar otro.",
    );
  }
  // EL QR SE ARMA EN EL SERVIDOR, sin red (la libreria dibuja el codigo): no hay llamada externa que
  // necesite timeout. Si falta la URL de la app, el pase NO se cae: sale con su enlace, que es lo que
  // sostiene la via. Un QR ausente estorba; un pase que no se puede emitir deja al paciente sin firmar.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const qrDataUrl = appUrl ? await qrDelLink(`${appUrl}/consentimiento/${s.token}`) : null;
  return { error: null, token: s.token, sessionId: s.id, qrDataUrl };
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

  // ═══ LA RAMA DE MENOR: LOS DATOS DEL REPRESENTANTE, ESCRITOS POR EL (0216) ═══
  //
  // SE MANDAN SIEMPRE QUE VENGAN, y es el ESCRITOR el que decide si aplican, mirando la rama que la sesion
  // fijo al emitir el pase. Decidirlo aqui seria creerle al formulario en lo que el formulario podria
  // equivocarse, que es el mismo criterio del guard de menores del escritor.
  //
  // EL CORREO ES OPCIONAL, y es la unica diferencia con el camino remoto: alli es obligatorio porque por
  // ahi va el codigo, que ES la verificacion de identidad. Aqui la verifica el profesional contra el
  // documento, y esta via existe precisamente porque no hay correo.
  const repNombre = s("representanteNombre");
  const r = await confirmarSesionPresencial({
    token,
    nombres,
    apellidos,
    documentType,
    documentNumber,
    autorizaciones,
    representante: repNombre
      ? {
          nombre: repNombre,
          documento: s("representanteDocumento"),
          parentesco: s("representanteParentesco"),
          email: s("representanteEmail") || null,
        }
      : undefined,
    asentimientoMenor: marcada("asentimiento_menor"),
  });

  if (r.estado === "faltan_datos_del_representante") {
    return {
      error:
        "Completa tu nombre, tu documento y tu parentesco con el menor, y marca que el menor dio su asentimiento si tiene 14 años o más.",
      estado: "pendiente",
      declarado: null,
    };
  }
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
  /**
   * Siempre false en esta via, y por construccion: la modalidad 2 existe porque el paciente NO tiene
   * correo. Viaja igual, en vez de darse por supuesto en la pantalla, para que el texto lo DERIVE.
   */
  tieneCorreo: boolean;
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
  const fail = (error: string): DeclararQrState => ({
    error,
    resumeToken: null,
    tieneCorreo: false,
  });
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

  // ═══ LA FECHA Y LA RAMA SALEN DE LA SESION, NO DEL FORMULARIO (0216) ═══
  //
  // Se escribieron al EMITIR el pase, con el documento delante, y son las que decidieron cual de los tres
  // textos de declaracion se le mostro al profesional. Volver a pedir la fecha aqui abriria la puerta a
  // que el texto que acepto y la edad que se guarda no correspondan, que es el estado imposible que esta
  // pieza existe para cerrar.
  //
  // UNA SESION SIN FECHA es de antes de este cambio. No se le inventa una (seria un dato del paciente que
  // nadie leyo): se dice que hay que volver a emitir el pase, que toma un segundo.
  if (!sesion.patientBirthDate) {
    return fail(
      "Este pase se emitió antes de que Atlas pidiera la fecha de nacimiento, así que no se puede saber si el paciente es menor de edad. Anúlalo y genera uno nuevo: ahora la fecha se pide al mostrar el código.",
    );
  }
  const esDeMenor = esDeclaracionDeMenor(sesion.declaracionVersion);
  // LA COHERENCIA SE COMPRUEBA, no se supone: una sesion de la rama menor sin representante no deberia
  // existir (lo impide el CHECK de la 0216 y lo comprueba el escritor de la confirmacion), y si existiera,
  // declarar sobre ella afirmaria que un representante autorizo cuando no consta quien.
  if (esDeMenor && !sesion.representante) {
    return fail(
      "Este pase es de un paciente menor de edad y no quedaron registrados los datos del representante legal. Anúlalo y genera uno nuevo.",
    );
  }

  const ip = await getClientIp();
  const { signIntakeEvaluation, ConsentGateError, ConsentimientoDeMenorSinRepresentanteError } =
    await import("@/modules/evaluations/data/intake-writer");
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
        // Del profesional, que ya los tenia. La FECHA sale de la sesion: se escribio al emitir.
        birthDate: sesion.patientBirthDate,
        sex: s("sex"),
        country: s("country") || null,
        city: s("city") || null,
        email: null,
        phone: s("phone") || null,
      },
      consents: [
        ...(sesion.autorizaciones ?? []).map((type) => ({
          type: type as never,
          consentVersion: CONSENT_VERSION,
          documentHash: CONSENT_DOCUMENT_HASH,
        })),
        // ═══ LA RAMA DE MENOR: LOS DOS TIPOS DERIVADOS (0216) ═══
        //
        // SON LOS MISMOS QUE ARMA EL CAMINO REMOTO (`survey-intake`), y se arman aqui por la misma razon:
        // no son casillas que alguien marque, son la consecuencia de que quien autorizo fue el
        // representante. Que las dos vias produzcan los MISMOS tipos es lo que hace que el gate clinico,
        // los lectores y la auditoria no tengan que saber por donde entro el consentimiento.
        //
        // EL CORREO VIAJA NULO SI NO LO DIO, y aqui si se puede: en el remoto es obligatorio porque por
        // ahi va el codigo, que ES la verificacion; aqui la identidad la verifico el profesional contra el
        // documento, con la persona delante.
        ...(esDeMenor && sesion.representante
          ? [
              {
                type: "representante_legal" as never,
                consentVersion: CONSENT_VERSION,
                documentHash: CONSENT_DOCUMENT_HASH,
                legalRepresentative: {
                  name: sesion.representante.nombre,
                  document: sesion.representante.documento,
                  relationship: sesion.representante.parentesco,
                  email: sesion.representante.email,
                },
              },
            ]
          : []),
        // EL ASENTIMIENTO SOLO SI LA DECLARACION LO AFIRMA. La 1.1-a existe porque para un menor de 14 el
        // profesional no puede declarar un asentimiento que no ocurrio; guardar la fila seria la misma
        // afirmacion falsa por la puerta de al lado.
        ...(declaracionAfirmaAsentimiento(sesion.declaracionVersion) && sesion.asentimientoMenor
          ? [
              {
                type: "asentimiento_menor" as never,
                consentVersion: CONSENT_VERSION,
                documentHash: CONSENT_DOCUMENT_HASH,
              },
            ]
          : []),
      ],
      linkId: null,
      ipAddress: ip === "unknown" ? null : ip,
      presencial: {
        canal: "presencial_qr",
        // LA PERSONA, no su ficha profesional: `declared_by` referencia `profiles(id)`. Pasar aqui el
        // `professional_profiles.id` (que esta a mano, dos lineas arriba) es el defecto que ya rompio un
        // smoke entero, y compila igual de verde porque los dos son uuid.
        declaradoPorProfileId: user.id,
        // LA VERSION ES LA DE LA SESION, la que se fijo al emitir y la que el profesional vio en pantalla.
        // Una constante aqui volveria a decir "1.0" sobre un menor, que es la declaracion equivocada.
        declaracionVersion: sesion.declaracionVersion,
        // La sesion se cierra dentro de la MISMA transaccion que crea al paciente.
        sessionId,
      },
    });
    revalidatePath("/pacientes");
    return { error: null, resumeToken: r.resumeToken, tieneCorreo: false };
  } catch (e) {
    if (e instanceof ConsentGateError) {
      return fail("Faltan autorizaciones necesarias: no se puede crear la evaluación.");
    }
    // ═══ EL MENOR SIN REPRESENTANTE: SE DICE, Y SE DICE OTRA COSA QUE EN EL CAMINO REMOTO ═══
    //
    // Sin esta rama caia en el generico de abajo (*"No pudimos crear el paciente en este momento. Intenta
    // de nuevo"*) mas una excepcion en Sentry. Es el PEOR desenlace: invita a repetir lo mismo, y lo mismo
    // va a volver a fallar porque el problema no es pasajero. Es la misma leccion que ya se aplico en
    // `survey-intake` el 2026-10-09, en el camino del enlace.
    //
    // Y NO SE REUSA SU MENSAJE, aunque el error lo traiga: ese esta escrito para el PACIENTE en su telefono
    // y le dice *"vuelve al paso anterior y elige la opcion de menor de edad"*. Aqui lo lee el PROFESIONAL,
    // y en este pase esa opcion NO EXISTE todavia: mandarlo a pulsar algo que no esta es un guard correcto
    // mal expuesto, que se vive como un sistema roto. Asi que dice la verdad: que por aqui no se puede, y
    // cual es el camino que si pide los datos del representante.
    // ═══ YA NO ES UN CALLEJON SIN SALIDA (0216) ═══
    //
    // ANTES DECIA que este pase no pedia los datos del representante y mandaba al camino del enlace, "y si
    // el representante no tiene correo, avisale a quien administra Atlas: ese caso aun no tiene salida".
    // Era cierto y era el hueco: la via presencial existe PORQUE no hay correo, asi que un menor sin
    // correo no tenia ninguna. La rama de menor ya vive en este pase.
    //
    // LA RAMA SE QUEDA COMO DEFENSA DE FONDO, no por si acaso: si el guard del escritor llega a disparar
    // aqui es que la sesion se emitio como de mayor y la fecha dice otra cosa, o sea que la version de la
    // declaracion y la edad no corresponden. Eso no se arregla reintentando, y el mensaje lo dice.
    if (e instanceof ConsentimientoDeMenorSinRepresentanteError) {
      return fail(
        "La fecha de nacimiento de este pase indica que el paciente es menor de edad, pero el pase se emitió como de mayor, así que no se pidieron los datos del representante legal. Anúlalo y genera uno nuevo: al escribir la fecha, Atlas abre la vía del representante.",
      );
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
