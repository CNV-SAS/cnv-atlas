import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { and, eq } from "drizzle-orm";

// EL CAMINO PUBLICO ENTERO, CONTRA LA BASE REAL (2026-09-08).
//
// POR QUE EXISTE. Los candados de la tanda anterior probaban la DECISION (con `esPacienteDelEnlace`
// mockeado) y el reuso de la pendiente SOLO por `startFollowupWithoutSignature`. Ninguno recorria el
// camino que de verdad usa el paciente: enlace de consultorio -> `signSurveyIntake` -> writer. Santiago
// entro por ahi y los dos arreglos no actuaron. Un candado que pasa verde con el hueco abierto certifica
// algo que no ocurre.
//
// LO UNICO QUE SE MOCKEA es el servicio OTP, que vive en Upstash y no es lo que se esta probando. Todo lo
// demas es real: la resolucion por documento, la RPC de propiedad, el gate y la escritura.

vi.mock("server-only", () => ({}));
vi.mock("@/modules/consent/otp/otp-service", () => ({
  verifyOtp: vi.fn(async () => ({
    status: "ok",
    meta: { channel: "email", maskedDestination: "***o.com", sentAt: Date.now() },
  })),
  consumeOtp: vi.fn(async () => true),
}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const SELLO = `PUB-${Date.now()}`;
const creados: string[] = [];

afterEach(async () => {
  if (!HAS_DB || creados.length === 0) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  for (const id of creados) {
    await db.delete(schema.evaluations).where(eq(schema.evaluations.patientId, id));
    await db.delete(schema.patientConsents).where(eq(schema.patientConsents.patientId, id));
    await db.delete(schema.patientContacts).where(eq(schema.patientContacts.patientId, id));
    await db.delete(schema.patientProfiles).where(eq(schema.patientProfiles.patientId, id));
    await db
      .delete(schema.patientProfessionalRelationships)
      .where(eq(schema.patientProfessionalRelationships.patientId, id));
    await db.delete(schema.patients).where(eq(schema.patients.id, id));
  }
  creados.length = 0;
});

// DOS profesionales distintos: el hueco solo existe entre dos, y con uno solo pasaria verde siempre.
async function dosProfesionales() {
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const filas = await db
    .select({
      professionalProfileId: schema.professionalProfiles.id,
      profileId: schema.professionalProfiles.profileId,
      organizationId: schema.profiles.organizationId,
    })
    .from(schema.professionalProfiles)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.professionalProfiles.profileId))
    .limit(5);
  const mismaOrg = filas.filter((f) => f.organizationId === filas[0]?.organizationId);
  return { a: mismaOrg[0], b: mismaOrg[1] };
}

function enlaceBase(pro: { professionalProfileId: string; organizationId: string }) {
  // La vista del enlace de consultorio: tipo inicial, reusable, sin paciente atado.
  return {
    id: "00000000-0000-4000-8000-000000000000",
    organizationId: pro.organizationId,
    professionalId: pro.professionalProfileId,
    type: "inicial" as const,
    patientId: null,
    prefill: null,
  };
}

function entrada(
  link: ReturnType<typeof enlaceBase>,
  documento: string,
  // LA FECHA Y LA RAMA SE PUEDEN PISAR, para los casos de menor de edad (2026-10-09). Por defecto sigue siendo
  // el mayor de siempre, asi que los casos anteriores no cambian.
  ajustes?: { birthDate?: string; ageBranch?: "mayor" | "menor" },
) {
  return {
    link,
    consent: {
      servicio: true,
      datos_sensibles: true,
      aceptacion_medio_electronico: true,
      investigacion: false,
      comunicaciones_continuidad: false,
      comunicaciones_comerciales: false,
      ageBranch: (ajustes?.ageBranch ?? "mayor") as "mayor" | "menor",
      mayoria_de_edad: true,
    },
    identity: {
      documentType: "CC",
      documentNumber: documento,
      firstName: "Prueba",
      lastName: "Publica",
      birthDate: ajustes?.birthDate ?? "1990-05-05",
      sex: "F",
      country: "Colombia",
      city: "Medellín",
      email: "prueba.publica@ejemplo.com",
      phone: null,
    },
    otp: { sessionId: "11111111-2222-3333-4444-555555555555", code: "123456" },
    ipAddress: null,
  };
}

describe.skipIf(!HAS_DB)("intake público por el enlace de consultorio (BD real)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un paciente que vuelve NO estrena encuesta: retoma la que tiene a medias", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { signSurveyIntake } = await import("@/modules/evaluations/services/survey-intake");
    const { a } = await dosProfesionales();
    const link = enlaceBase(a);
    const doc = `${SELLO}-VUELVE`;

    const primera = await signSurveyIntake(entrada(link, doc));
    expect(primera.ok, "la primera firma tiene que pasar").toBe(true);
    if (!primera.ok) return;
    creados.push(primera.value.patientId);

    // Y vuelve a entrar por el MISMO enlace con la MISMA cédula, sin haber respondido nada.
    const segunda = await signSurveyIntake(entrada(link, doc));
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;

    expect(segunda.value.evaluationId, "tiene que ser la misma evaluación").toBe(
      primera.value.evaluationId,
    );
    const todas = await db
      .select({ id: schema.evaluations.id })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.patientId, primera.value.patientId));
    expect(todas, "dos juegos de respuestas del mismo paciente").toHaveLength(1);
  });

  // ═══ UN MENOR NO SE CONSIENTE SIN REPRESENTANTE (legal, 2026-10-09) ═══
  //
  // ── EL CASO ──────────────────────────────────────────────────────────────────────────────────────
  //
  // Seis evaluaciones de menores quedaron bloqueadas al confirmar identidad porque su consentimiento se habia
  // guardado SIN representante: entraron por el QR, que no tiene rama de menor y no la pregunta.
  //
  // Y EL `consentSchema` YA EXIGIA los datos del representante cuando la rama declarada es "menor". Aun asi
  // paso, porque el QR no usa ese schema. Textual de legal: *"este hueco existio porque el formulario permitio
  // guardar un estado imposible, y mientras eso siga siendo posible va a volver a ocurrir POR OTRA VIA"*.
  //
  // POR ESO EL GUARD VA EN EL WRITER, que es el unico sitio por donde se escribe un consentimiento, y por eso
  // estos casos entran por el SERVICIO publico: lo que hay que probar es que el camino REAL del paciente no
  // puede guardar el estado imposible, no que una funcion interna lo rechace.
  //
  // Y SE DECIDE POR LA EDAD, NO POR LA RAMA DECLARADA: mirar la rama seria creerle al formulario justo en lo
  // que el formulario se equivoco. La fecha es el hecho; la rama es lo que alguien dijo sobre el hecho.
  it("con fecha de menor y rama de mayor, la firma se rechaza y dice qué hacer", async () => {
    const { signSurveyIntake } = await import("@/modules/evaluations/services/survey-intake");
    const { a } = await dosProfesionales();
    const doc = `${SELLO}-MENOR`;
    // 13 años hoy, y la rama declarada dice "mayor": exactamente lo que el QR producia.
    const nacimiento = new Date();
    nacimiento.setFullYear(nacimiento.getFullYear() - 13);

    const res = await signSurveyIntake(
      entrada(enlaceBase(a), doc, { birthDate: nacimiento.toISOString().slice(0, 10) }),
    );
    expect(res.ok, "se guardo un consentimiento de menor sin representante").toBe(false);
    if (res.ok) return;
    // EL MENSAJE DICE QUE HACER, no solo que no se puede: quien esta ahi es el familiar, sin nadie al lado, y
    // la rama de menor esta a un clic. Un "no pudimos completar la firma" lo invitaria a reintentar lo mismo.
    expect(res.error.message).toContain("menor de edad");

    // Y NO QUEDA NADA ESCRITO. Un rechazo a medias seria peor que no rechazar: dejaria el paciente creado y
    // sin consentimiento, que es otro estado imposible.
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const quedo = await db
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(eq(schema.patients.documentNumber, doc));
    expect(quedo, "el rechazo dejo el paciente creado sin consentimiento").toHaveLength(0);
  });

  it("y un mayor sigue pasando sin representante, que es el control de que no bloquea a todos", async () => {
    // SIN ESTE CASO, un guard que rechazara SIEMPRE pasaria el anterior en verde.
    const { signSurveyIntake } = await import("@/modules/evaluations/services/survey-intake");
    const { a } = await dosProfesionales();
    const res = await signSurveyIntake(entrada(enlaceBase(a), `${SELLO}-MAYOR`));
    expect(res.ok, res.ok ? "" : res.error.message).toBe(true);
    if (res.ok) creados.push(res.value.patientId);
  });

  // ═══ Y SI ESA PENDIENTE SE RETIRO, NO SE REUSA: SE ESTRENA OTRA (0212, 2026-10-07) ═══
  //
  // ES EL CASO INVERSO DEL DE ARRIBA, y por eso va pegado: el reuso es correcto salvo cuando alguien ya
  // dijo que esa consulta NO OCURRIO. Sin el filtro, el paciente que vuelve a entrar RESUCITA la consulta
  // retirada y mete sus respuestas nuevas dentro, deshaciendo el retiro sin que nadie lo decida.
  //
  // Era el unico sitio de todo el barrido donde el retiro se podia perder solo, y lo encontro el candado
  // del barrido (`la-consulta-retirada-no-reaparece`), no una pantalla.
  it("pero si la pendiente se retiró, estrena otra en vez de resucitarla", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { signSurveyIntake } = await import("@/modules/evaluations/services/survey-intake");
    const { retirarEvaluacion } = await import("@/modules/evaluations/data/evaluations-writer");
    const { a } = await dosProfesionales();
    const link = enlaceBase(a);
    const doc = `${SELLO}-RETIRADA`;

    const primera = await signSurveyIntake(entrada(link, doc));
    expect(primera.ok, "la primera firma tiene que pasar").toBe(true);
    if (!primera.ok) return;
    creados.push(primera.value.patientId);

    await retirarEvaluacion({
      evaluationId: primera.value.evaluationId,
      motivo: "agendó y no vino",
      actorId: a.profileId,
      actorEmail: "candado@ejemplo.com",
      ip: null,
    });

    const segunda = await signSurveyIntake(entrada(link, doc));
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;

    expect(
      segunda.value.evaluationId,
      "reusó la consulta retirada: el paciente la resucitó sin que nadie lo decidiera",
    ).not.toBe(primera.value.evaluationId);

    // Y LA RETIRADA SIGUE RETIRADA, que es la otra mitad: no basta con crear otra si la primera se
    // reabrio por el camino.
    const [vieja] = await db
      .select({ retiradaAt: schema.evaluations.retiradaAt })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, primera.value.evaluationId));
    expect(vieja?.retiradaAt, "el retiro de la primera se perdió").not.toBeNull();
  });

  it("y la cédula de un paciente AJENO se para, sin dejar la relación creada", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { signSurveyIntake, INTAKE_ENLACE_QUE_NO_CORRESPONDE } = await import(
      "@/modules/evaluations/services/survey-intake"
    );
    const { a, b } = await dosProfesionales();
    expect(b, "hacen falta DOS profesionales de la misma organización").toBeDefined();
    const doc = `${SELLO}-AJENO`;

    // El paciente nace bajo el profesional A, por su enlace.
    const suyo = await signSurveyIntake(entrada(enlaceBase(a), doc));
    expect(suyo.ok).toBe(true);
    if (!suyo.ok) return;
    creados.push(suyo.value.patientId);

    // Y ahora el profesional B teclea esa misma cédula en SU enlace de consultorio.
    const intento = await signSurveyIntake(entrada(enlaceBase(b), doc));
    expect(intento.ok, "no puede pasar").toBe(false);
    if (intento.ok) return;
    // El cuerpo sigue diciendo lo mismo, y ahora lleva pegado el código de referencia (2026-09-08). Se
    // comprueba el FORMATO del código, no su valor: es aleatorio en cada intento a propósito.
    expect(intento.error.message).toContain(INTAKE_ENLACE_QUE_NO_CORRESPONDE);
    expect(intento.error.message).toMatch(
      /Código de referencia: [ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}\.$/,
    );

    // LO QUE DE VERDAD IMPORTA: la relación no existe. Es la fila que abre la historia clínica entera.
    const rel = await db
      .select({ id: schema.patientProfessionalRelationships.patientId })
      .from(schema.patientProfessionalRelationships)
      .where(
        and(
          eq(schema.patientProfessionalRelationships.patientId, suyo.value.patientId),
          eq(schema.patientProfessionalRelationships.professionalId, b.professionalProfileId),
        ),
      );
    expect(rel, "B quedó vinculado al paciente de A").toHaveLength(0);
  });
});

// ── EL DEFECTO QUE SANTIAGO VIO COMO "LA ENCUESTA EMPIEZA DESDE CERO" ───────────────────────────────
//
// El reuso SI ocurria (el audit de la nube lo registro dos veces), pero la pantalla no lo acompañaba: el
// paciente caia en la encuesta de despues de firmar, que arranca EN BLANCO. Y como el guardado manda el
// SNAPSHOT COMPLETO, enviarla vacia le habria borrado lo que ya llevaba. Reusar la evaluacion sin reusar
// sus respuestas es peor que no reusarla.
describe.skipIf(!HAS_DB)("al retomar, las respuestas siguen ahí (BD real)", () => {
  it("lo ya respondido sobrevive a la segunda firma, y el token lo devuelve", async () => {
    const { signSurveyIntake, saveProgress, readSurveyProgress } = await import(
      "@/modules/evaluations/services/survey-intake"
    );
    const { getActiveSurvey } = await import("@/modules/evaluations/data/survey-reader");
    const { a } = await dosProfesionales();
    const link = enlaceBase(a);
    const doc = `${SELLO}-RESP`;

    const primera = await signSurveyIntake(entrada(link, doc));
    expect(primera.ok).toBe(true);
    if (!primera.ok) return;
    creados.push(primera.value.patientId);
    expect(primera.value.reused, "la primera no retoma nada").toBe(false);

    // El paciente responde algo y se va.
    const survey = await getActiveSurvey();
    expect(survey, "hace falta una encuesta activa").not.toBeNull();
    const pregunta = survey!.questions[0];
    const guardado = await saveProgress({
      resumeToken: primera.value.resumeToken,
      surveyVersionId: survey!.surveyVersionId,
      answers: [{ questionId: pregunta.id, answerValue: "MARCA-DE-PRUEBA" }],
      ipAddress: null,
    });
    expect(guardado.ok).toBe(true);

    // Y vuelve a entrar por el enlace de consultorio.
    const segunda = await signSurveyIntake(entrada(link, doc));
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.value.reused, "hay que AVISAR que se retomó, no solo retomar").toBe(true);

    // LO QUE IMPORTA: con el token que se le devuelve, su respuesta sigue estando. Es lo que la pantalla
    // de reanudación carga, y a donde el orquestador tiene que mandarlo.
    const progreso = await readSurveyProgress(segunda.value.resumeToken);
    expect(progreso, "el token devuelto tiene que abrir su encuesta").not.toBeNull();
    expect(
      progreso!.answers.some((r) => r.answerValue === "MARCA-DE-PRUEBA"),
      "se perdió lo que el paciente ya había respondido",
    ).toBe(true);
  });
});
