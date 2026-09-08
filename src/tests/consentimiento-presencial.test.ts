import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DECLARACION_PRESENCIAL,
  DECLARACION_PRESENCIAL_VERSION,
} from "@/modules/consent/text/declaracion-presencial";

import { DOCUMENTO_AJENO } from "@/modules/patients/text/documento-ajeno";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL CONSENTIMIENTO PRESENCIAL (dictamen legal 2026-09-08, modalidad 1 retirada el 09-09).
//
// EL HUECO QUE CIERRA, medido antes de construir: un paciente SIN CORREO entraba hasta la mitad y se
// quedaba ahi. El schema de identidad acepta `email` nulo, pero la firma verifica SIEMPRE el OTP (art. 4
// Decreto 2364) y el OTP solo va a un correo. Sin firma no hay evaluacion.
//
// LO QUE ESTE CANDADO PROTEGE, despues de retirar la modalidad 1 (ver el bloque de abajo):
//
//   1. que la declaracion del profesional NO sustituya al gate de la regla dura 15;
//   2. que el canal y la declaracion queden SELLADOS en la autorizacion, y que la base rechace una fila
//      incoherente (canal presencial sin declaracion, o al reves);
//   3. que la declaracion vaya CON SU VERSION, no como booleano;
//   4. y que lo del CAMINO COMPARTIDO siga en pie: la busqueda por documento, el codigo de soporte y el
//      envio del OTP, que no eran de la modalidad 1 aunque se construyeran con ella.
//
// Los puntos 1 a 3 gobiernan las modalidades que quedan (QR y papel), que es donde la declaracion carga
// peso de verdad: ahi no hay OTP.

const MIGRACION = readFileSync("drizzle/0105_consentimiento_presencial.sql", "utf8");
const WRITER = readFileSync("src/modules/evaluations/data/intake-writer.ts", "utf8");
const SCHEMA = readFileSync("src/db/schema/patients.ts", "utf8");

describe("la casilla del profesional NO sustituye al gate", () => {
  it("el gate sigue leyendo patient_consents DENTRO de la transacción", () => {
    // Es el atajo que alguien tomaria: marcar la casilla y dar por consentido. Las columnas nuevas dicen
    // COMO se obtuvo el permiso; no lo otorgan.
    const limpio = sinComentarios(WRITER);
    expect(limpio).toContain("canCreateEvaluation(");
    expect(limpio).toContain("throw new ConsentGateError(");
  });

  it("y la declaración NO es una vía para saltarse una autorización faltante", () => {
    // El gate mira `patient_consents` por TIPO vigente. Que exista `declared_by` no añade ningun tipo.
    const limpio = sinComentarios(WRITER);
    const iGate = limpio.indexOf("canCreateEvaluation(");
    const bloque = limpio.slice(Math.max(0, iGate - 600), iGate);
    expect(bloque, "el gate debe leer las autorizaciones vigentes, no la declaración").toContain(
      "isNull(patientConsents.revokedAt)",
    );
    expect(bloque).not.toContain("declaredBy");
  });
});

describe("la modalidad y la declaración quedan selladas en la autorización", () => {
  it("las tres columnas existen en el schema de Drizzle, no solo en el SQL", () => {
    // SIN ESTO EL INSERT LAS TIRA EN SILENCIO: `values()` con claves que el schema no declara compila
    // verde y no escribe nada. Paso al construir esto: la migracion estaba aplicada, tsc en verde, y las
    // columnas no habrian recibido un solo dato.
    expect(SCHEMA).toContain('signatureChannel: text("signature_channel")');
    expect(SCHEMA).toContain('declaredBy: uuid("declared_by")');
    expect(SCHEMA).toContain('declarationVersion: text("declaration_version")');
  });

  it("el writer las escribe, y el remoto queda marcado como tal", () => {
    // El camino de siempre tambien se sella: sin eso, "sin canal" significaria dos cosas (viejo o remoto).
    expect(WRITER).toContain('signatureChannel: input.presencial ? input.presencial.canal : "remoto_otp"');
    expect(WRITER).toContain("declaredBy: input.presencial?.declaradoPorProfileId ?? null");
    expect(WRITER).toContain("declarationVersion: input.presencial?.declaracionVersion ?? null");
  });

  it("y la base RECHAZA una fila incoherente, no solo el código", () => {
    // Verificado contra Postgres real en transacciones revertidas: presencial sin declaracion, declaracion
    // sin canal presencial, y canal inventado, los tres rechazados por el CHECK.
    expect(MIGRACION).toContain("patient_consents_declaracion_coherente");
    expect(MIGRACION).toContain("patient_consents_signature_channel_check");
    for (const canal of ["remoto_otp", "presencial_otp", "presencial_qr", "presencial_papel"]) {
      expect(MIGRACION, `falta el canal ${canal}`).toContain(canal);
    }
  });
});

describe("la declaración se versiona, no es un booleano", () => {
  it("tiene versión y texto, y el texto es el del dictamen", () => {
    // Si mañana cambia su redaccion, lo declarado antes tiene que seguir diciendo lo que decia. Un
    // booleano dejaria constancia de que "declaro algo" sin poder citar QUE.
    expect(DECLARACION_PRESENCIAL_VERSION).toBe("1.0");
    expect(DECLARACION_PRESENCIAL).toContain("presenté el consentimiento al paciente");
    expect(DECLARACION_PRESENCIAL).toContain("tuvo oportunidad de leerlo");
    expect(DECLARACION_PRESENCIAL).toContain("fue él quien marcó las autorizaciones");
    expect(DECLARACION_PRESENCIAL).toContain("verifiqué su identidad contra su documento");
  });

  it("y las CUATRO afirmaciones siguen ahí: quitar una cambia el alcance", () => {
    // El valor probatorio esta en lo que el profesional afirma. Recortarlo "para que quede mas corto"
    // reduce lo que se puede sostener despues, y eso no es una decision de redaccion.
    const afirmaciones = DECLARACION_PRESENCIAL.split(",").filter((f) => f.trim().length > 10);
    expect(afirmaciones.length).toBeGreaterThanOrEqual(4);
  });
});

// ── LO QUE SOBREVIVE A LA MODALIDAD 1 (retirada el 2026-09-09) ─────────────────────────────────────
//
// La modalidad 1 (el paciente marcaba y digitaba su codigo en la pantalla del profesional) se retiro: no
// aportaba nada que el enlace del consultorio no diera, porque la cadena probatoria es la MISMA y el sello
// de canal registraba DONDE estaba el paciente, que no forma parte de esa cadena.
//
// CON ELLA SE FUERON sus candados: los dos avisos probatorios, la casilla de declaracion en el formulario
// de firma, el documento en solo lectura y la accion de firma presencial. No se relajaron: dejo de existir
// lo que afirmaban.
//
// LO QUE NO SE VA es lo del CAMINO COMPARTIDO, y estos tres candados son los que lo sostienen.
const FORM = readFileSync("src/modules/evaluations/components/sign-phase-form.tsx", "utf8");
const ACTIONS = readFileSync("src/modules/evaluations/actions.ts", "utf8");
const BUSQUEDA = readFileSync("src/modules/patients/actions.ts", "utf8");

describe("el camino compartido sigue en pie", () => {
  it("la búsqueda por documento conserva sus TRES veredictos", () => {
    // Es del camino compartido, no de la modalidad 1: la usan la pantalla del profesional y (por su
    // gemela del intake) el enlace publico.
    const SRC = readFileSync("src/modules/patients/data/buscar-por-documento.ts", "utf8");
    const estados = [...SRC.matchAll(/estado: "([a-z]+)"/g)].map((m) => m[1]);
    expect(new Set(estados)).toEqual(new Set(["libre", "propio", "ajeno"]));
    expect(BUSQUEDA).toContain("documentoAjenoParaProfesional(veredicto.codigo)");
  });

  it("y el código de referencia para soporte sigue vivo, con su razón", () => {
    // Su motivo no era la modalidad 1 sino la PII: sin codigo, lo primero que soporte pide es la cedula.
    const COD = readFileSync("src/modules/patients/codigo-soporte.ts", "utf8");
    expect(sinComentarios(COD)).toContain("randomBytes");
    expect(DOCUMENTO_AJENO).toContain("No podemos darte más detalles");
  });

  it("el envío del código sigue compartido, y el camino público sigue exigiendo su token", () => {
    // El servicio se extrajo para que dos superficies no divergieran. Al retirarse una, la que queda es la
    // publica, y lo que hay que fijar es que NO perdio su guarda en el camino.
    const limpio = sinComentarios(ACTIONS);
    const i = limpio.indexOf("export async function sendConsentOtpAction");
    const cuerpo = limpio.slice(i, i + 1600);
    expect(cuerpo).toContain('const token = str(form, "token")');
    expect(cuerpo).toContain("await resolveSurveyLinkByToken(token)");
    expect(cuerpo).toContain("await enviarCodigoDeFirma(");
  });

  it("y NINGUNA acción pública puede declararse presencial", () => {
    // Sin sesion no hay quien declare. Si una accion publica aceptara el bloque presencial, cualquiera
    // podria marcar una autorizacion como obtenida en consultorio y atribuirsela a un profesional.
    const limpio = sinComentarios(ACTIONS);
    expect(limpio, "ninguna acción de este archivo debe sellar canal presencial").not.toContain(
      "presencial_otp",
    );
  });

  it("el formulario de firma quedó SIN modo presencial", () => {
    // Se retira, no se deja apagado: un modo muerto detras de una bandera invita a reactivarlo sin volver
    // a preguntarse si aporta algo.
    const limpio = sinComentarios(FORM);
    for (const resto of ["presencial", "declaracionPresencial", "AVISO_CASILLAS", "AVISO_CODIGO"]) {
      expect(limpio, `quedó ${resto} en el formulario de firma`).not.toContain(resto);
    }
  });
});

describe("al retomar, la pantalla lleva a donde están las respuestas", () => {
  const ORQ = readFileSync("src/modules/evaluations/components/survey-intake-form.tsx", "utf8");

  it("el orquestador navega a la reanudación cuando se retomó", () => {
    const limpio = sinComentarios(ORQ);
    expect(limpio).toContain("router.replace(`/encuesta/reanudar/${tokenValue}`)");
  });

  it("y NO cae en la encuesta en blanco: son ramas excluyentes", () => {
    // Si las dos pudieran ocurrir, el paciente veria un parpadeo y, peor, el formulario en blanco podria
    // enviarse. El guardado manda el snapshot COMPLETO: eso le borraria lo que llevaba.
    const limpio = sinComentarios(ORQ);
    const i = limpio.indexOf("if (reanudar)");
    const bloque = limpio.slice(i, i + 200);
    expect(bloque).toContain("else setResumeToken(tokenValue)");
  });

  it("los DOS caminos que crean evaluación pasan la señal, no solo el de firma", () => {
    // El seguimiento sin firma tambien retoma, y con el mismo defecto. Cubrir uno solo dejaria el hueco
    // abierto en el camino que mas se usa.
    const limpio = sinComentarios(ORQ);
    expect(limpio).toContain("onSigned={handleSigned}");
    expect(limpio).toContain("onStarted={handleStarted}");
    expect(limpio).toContain("(tokenValue: string, reanudar: boolean) => continuar(tokenValue, reanudar)");
  });
});
