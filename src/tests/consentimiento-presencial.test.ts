import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  AVISO_CASILLAS,
  AVISO_CODIGO,
  DECLARACION_PRESENCIAL,
  DECLARACION_PRESENCIAL_VERSION,
} from "@/modules/consent/text/declaracion-presencial";

import {
  DOCUMENTO_AJENO,
  DOCUMENTO_AJENO_AL_FIRMAR,
} from "@/modules/patients/text/documento-ajeno";

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

// ── LA MODALIDAD 1, YA CONSTRUIDA (2026-09-08) ─────────────────────────────────────────────────────
//
// Lo de arriba protege el ALMACEN (que la fila quede sellada y coherente). Esto protege la PANTALLA y la
// ACCION, que es donde la mitad probatoria se puede perder sin que nada truene: un aviso que se escribe
// pero no se renderiza no dice nada, y una declaracion que el formulario pueda afirmar no declara nada.

const FORM = readFileSync("src/modules/evaluations/components/sign-phase-form.tsx", "utf8");
const ACTIONS = readFileSync("src/modules/evaluations/actions.ts", "utf8");
const BUSQUEDA = readFileSync("src/modules/patients/actions.ts", "utf8");

describe("las dos frases se RENDERIZAN donde ocurre cada cosa", () => {
  it("el aviso de las casillas va DENTRO del bloque de autorizaciones necesarias", () => {
    // No basta con que el texto exista (la leccion del bloque que se porto y resulto ser print-only). Lo
    // que importa es DONDE queda: entre el rotulo del bloque y la primera casilla, que es lo que el
    // profesional lee justo antes de pasar el dispositivo.
    const iLegend = FORM.indexOf("Autorizaciones necesarias para el servicio");
    const iAviso = FORM.indexOf("{AVISO_CASILLAS}");
    const iPrimera = FORM.indexOf('name="servicio"');
    expect(iAviso, "el aviso de las casillas no se renderiza").toBeGreaterThan(-1);
    expect(iAviso).toBeGreaterThan(iLegend);
    expect(iAviso, "el aviso quedó DESPUÉS de las casillas: ahí ya se marcaron").toBeLessThan(iPrimera);
  });

  it("el aviso del código va JUNTO al campo del código", () => {
    const iAviso = FORM.indexOf("{AVISO_CODIGO}");
    const iCampo = FORM.indexOf('name="otpCode"');
    expect(iAviso, "el aviso del código no se renderiza").toBeGreaterThan(-1);
    expect(iAviso).toBeLessThan(iCampo);
    // Y PEGADO, no a media pantalla: el bloque de firma entero cabe en menos de eso.
    expect(iCampo - iAviso).toBeLessThan(1500);
  });

  it("y solo en presencial: el paciente que firma solo no tiene a quién pasarle el dispositivo", () => {
    // Las dos frases hablan de un profesional que esta al lado. En el enlace publico no hay nadie al lado,
    // y decirlas ahi confundiria sobre quien tiene que hacer que.
    for (const aviso of ["{AVISO_CASILLAS}", "{AVISO_CODIGO}"]) {
      const i = FORM.indexOf(aviso);
      const antes = FORM.slice(Math.max(0, i - 300), i);
      expect(antes, `${aviso} no está condicionado a presencial`).toContain("presencial ?");
    }
  });
});

describe("la declaración no se puede saltar", () => {
  it("el botón de firmar la exige en cliente", () => {
    const limpio = sinComentarios(FORM);
    const iBoton = limpio.indexOf('key="nav-submit"');
    const bloque = limpio.slice(iBoton, iBoton + 500);
    expect(bloque).toContain("presencial && !declarado");
  });

  it("y el SERVIDOR la vuelve a exigir, que es lo que de verdad la hace requisito", () => {
    // El cliente solo evita que el profesional descubra el requisito con un error. Si la exigencia viviera
    // solo ahi, bastaria con enviar el formulario por otra via.
    const limpio = sinComentarios(ACTIONS);
    const i = limpio.indexOf("export async function firmarPresencialAction");
    const cuerpo = limpio.slice(i, i + 3000);
    expect(cuerpo).toContain('checkbox(form, "declaracionPresencial")');
  });
});

describe("quién declara sale de la SESIÓN, nunca del formulario", () => {
  it("declaradoPor es el profesional autenticado", () => {
    const limpio = sinComentarios(ACTIONS);
    const i = limpio.indexOf("export async function firmarPresencialAction");
    const cuerpo = limpio.slice(i, i + 3000);
    expect(cuerpo).toContain("const professionalId = await getProfessionalProfileIdByUser(user.id)");
    expect(cuerpo).toContain("declaradoPor: professionalId");
    expect(cuerpo, "un id de profesional leído del formulario sería una declaración autofirmada").not.toContain(
      'str(form, "declaradoPor")',
    );
  });

  it("y la acción PÚBLICA no puede declararse presencial", () => {
    // `signSurveyAction` no tiene sesion: si aceptara el bloque presencial, cualquiera podria marcar una
    // autorizacion como obtenida en consultorio y atribuirsela a un profesional.
    const limpio = sinComentarios(ACTIONS);
    const i = limpio.indexOf("export async function signSurveyAction");
    const cuerpo = limpio.slice(i, limpio.indexOf("export async function firmarPresencialAction"));
    expect(cuerpo.includes("presencial")).toBe(false);
  });
});

describe("el documento ajeno no se puede firmar en consulta", () => {
  it("la acción vuelve a pedir el veredicto EN SERVIDOR antes de escribir", () => {
    // El veredicto que traiga el cliente no vale: entre la busqueda y la firma pudo cambiar, y el
    // documento enviado pudo ser otro. Esta lectura es la que gobierna, y de paso audita el intento.
    const limpio = sinComentarios(ACTIONS);
    const i = limpio.indexOf("export async function firmarPresencialAction");
    const cuerpo = limpio.slice(i, i + 3000);
    const iBusqueda = cuerpo.indexOf("await buscarPorDocumento(");
    const iFirma = cuerpo.indexOf("await signSurveyIntake(");
    expect(iBusqueda, "no se vuelve a verificar el documento").toBeGreaterThan(-1);
    expect(iBusqueda, "se verifica DESPUÉS de firmar: ya sería tarde").toBeLessThan(iFirma);
    expect(cuerpo).toContain('veredicto.estado === "ajeno"');
  });

  it("y el mensaje del ajeno no dice de quién es ni cómo se llama", () => {
    // Es el camino que Santiago pidio ver: el que no puede decir de mas. Dice que existe (cosa que el
    // error del unique ya revelaba), que no es suyo, y que no hay mas que decir.
    //
    // SE LEE ARMADO, no del codigo fuente: partido en literales concatenados, una asercion sobre el
    // fuente puede fallar (o pasar) por donde cae el corte de linea, que no es lo que se quiere probar.
    for (const mensaje of [DOCUMENTO_AJENO, DOCUMENTO_AJENO_AL_FIRMAR]) {
      expect(mensaje).toContain("no está bajo tu cuidado");
      expect(mensaje).toContain("escribe a soporte");
      for (const prohibido of ["nombre", "profesional a cargo", "desde", "creado", "@"]) {
        expect(mensaje.toLowerCase(), `el mensaje menciona ${prohibido}`).not.toContain(prohibido);
      }
    }
    // Y el de la búsqueda además dice EXPLÍCITAMENTE que no hay más que contar: sin esa frase, el
    // profesional interpreta el silencio y vuelve a preguntar por otra vía.
    expect(DOCUMENTO_AJENO).toContain("No podemos darte más detalles");
    // Los dos textos van al MISMO sitio de la pantalla, así que se leen seguidos: el segundo no puede
    // contar algo que el primero calló.
    expect(BUSQUEDA).toContain("DOCUMENTO_AJENO");
  });
});

// ── EL CODIGO DE FIRMA EN CONSULTA (defecto del smoke A, 2026-09-08) ───────────────────────────────
//
// EL DEFECTO: al pedir el codigo salia "Link invalido" y bloqueaba la firma entera. `sendConsentOtpAction`
// arranca exigiendo el token del enlace, y en presencial no hay enlace. La comprobacion automatica del
// codigo NO lo pedia, asi que esa mitad ya funcionaba: era solo el envio.
describe("el envío del código en presencial no afloja nada", () => {
  it("la acción presencial NO exige token, y la pública SIGUE exigiéndolo", () => {
    const limpio = sinComentarios(ACTIONS);
    const iPresencial = limpio.indexOf("export async function enviarCodigoPresencialAction");
    const presencial = limpio.slice(iPresencial, iPresencial + 1500);
    expect(presencial, "en presencial no hay enlace que resolver").not.toContain(
      "resolveSurveyLinkByToken",
    );

    // Y el control: la publica no puede haber perdido su guarda al compartir el envio.
    const iPublica = limpio.indexOf("export async function sendConsentOtpAction");
    const publica = limpio.slice(iPublica, iPresencial);
    expect(publica).toContain('const token = str(form, "token")');
    expect(publica).toContain("await resolveSurveyLinkByToken(token)");
  });

  it("lo que reemplaza al token es la SESIÓN, no la ausencia de guarda", () => {
    const limpio = sinComentarios(ACTIONS);
    const i = limpio.indexOf("export async function enviarCodigoPresencialAction");
    const cuerpo = limpio.slice(i, i + 1500);
    expect(cuerpo).toContain("const user = await requireUser()");
    expect(cuerpo).toContain("canCreatePatientPresencial(user)");
  });

  it("el destino sale del campo del PACIENTE, nunca de la sesión del profesional", () => {
    // Si saliera de la sesión, el código llegaría a la bandeja del profesional y la firma dejaría de
    // probar que fue el paciente. El comportamiento está probado en `enviar-codigo-firma.test.ts`; aquí
    // se fija que esta acción no le pase otra cosa.
    const limpio = sinComentarios(ACTIONS);
    const i = limpio.indexOf("export async function enviarCodigoPresencialAction");
    const cuerpo = limpio.slice(i, i + 1500);
    expect(cuerpo).toContain(
      'const destino = ageBranch === "menor" ? str(form, "legalRepresentativeEmail") : str(form, "email")',
    );
    expect(cuerpo, "el correo del profesional no es un destino válido").not.toContain("user.email");
  });

  it("y las DOS pasan por el mismo servicio, que es lo que impide que diverjan", () => {
    // La garantía de que el código se consume AL PERSISTIR vive en `survey-intake.test.ts`, sobre
    // `signSurveyIntake`. Cubre presencial porque presencial pasa por ahí: si algún día tuviera camino
    // propio, esa garantía dejaría de aplicarle sin que ningún test se pusiera rojo.
    const limpio = sinComentarios(ACTIONS);
    const usos = [...limpio.matchAll(/await enviarCodigoDeFirma\(/g)].length;
    expect(usos, "hay un camino de envío que no pasa por el servicio compartido").toBe(2);
    const iPresencial = limpio.indexOf("export async function firmarPresencialAction");
    expect(limpio.slice(iPresencial, iPresencial + 3000)).toContain("await signSurveyIntake(");
  });
});
