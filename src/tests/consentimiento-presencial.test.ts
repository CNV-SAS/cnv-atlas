import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  AVISO_CASILLAS,
  AVISO_CODIGO,
  DECLARACION_PRESENCIAL,
  DECLARACION_PRESENCIAL_VERSION,
} from "@/modules/consent/text/declaracion-presencial";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL CONSENTIMIENTO PRESENCIAL · MODALIDAD 1 (dictamen legal 2026-09-08).
//
// EL HUECO QUE CIERRA, medido antes de construir: un paciente SIN CORREO entraba hasta la mitad y se
// quedaba ahi. El schema de identidad acepta `email` nulo, pero la firma verifica SIEMPRE el OTP (art. 4
// Decreto 2364) y el OTP solo va a un correo. Sin firma no hay evaluacion.
//
// LO QUE ESTE CANDADO PROTEGE es la MITAD PROBATORIA, que es lo unico que hace valida la modalidad:
//
//   1. que la casilla del profesional NO sustituya al gate;
//   2. que la declaracion vaya CON SU VERSION, no como booleano;
//   3. y que las dos frases que dicen quien marca y quien digita esten pegadas a donde ocurre cada cosa.
//
// La 3 no es ayuda al usuario: si las casillas las marca el profesional o el codigo lo digita el, la firma
// electronica deja de probar que fue el paciente, y la modalidad pierde su valor.

const MIGRACION = readFileSync("drizzle/0105_consentimiento_presencial.sql", "utf8");
const WRITER = readFileSync("src/modules/evaluations/data/intake-writer.ts", "utf8");
const SCHEMA = readFileSync("src/db/schema/patients.ts", "utf8");
const TEXTO = readFileSync("src/modules/consent/text/declaracion-presencial.ts", "utf8");

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
    expect(WRITER).toContain("declaredBy: input.presencial?.declaradoPor ?? null");
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

describe("las dos frases probatorias dicen quién hace qué", () => {
  it("las casillas las marca el PACIENTE, y lo dice", () => {
    expect(AVISO_CASILLAS).toContain("Pásale el dispositivo al paciente");
    expect(AVISO_CASILLAS, "y la consecuencia, no solo la instrucción").toContain("invalida el consentimiento");
  });

  it("el código lo digita el PACIENTE, y dice por qué", () => {
    // "Es lo unico que prueba que fue el" es la razon, y sin ella la instruccion se lee como formalismo y
    // se salta. Con ella, saltarsela es una decision.
    expect(AVISO_CODIGO).toContain("El código lo digita el paciente");
    expect(AVISO_CODIGO).toContain("es lo único que prueba que fue él");
  });

  it("y las dos van PEGADAS a donde ocurre cada cosa, no en un aviso al principio", () => {
    // Es la leccion del punto 13 del cotejo: un aviso a media pantalla del sitio donde se actua no se lee.
    // Santiago lo probo preguntando justo lo que el parrafo de arriba ya explicaba.
    expect(TEXTO).toContain("Va JUNTO a las casillas");
    expect(TEXTO).toContain("Va JUNTO al campo del codigo");
    expect(TEXTO, "no pueden ser un aviso previo que se cierra").toContain("no son un aviso previo");
  });
});
