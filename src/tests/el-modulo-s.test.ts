import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  adherenciaAdecuada,
  clavesAConfirmar,
  CLAVE_ANTECEDENTES_FAMILIARES,
  medicionComparable,
  saltoDeLosDigestivos,
  S1_OPCIONES,
  tocaReconfirmacionAnual,
} from "@/modules/followups/modulo-s";
import {
  CNVS_ACTIVA,
  CNVS_EN_PRUEBAS,
  instrumentoParaLaConsulta,
} from "@/modules/evaluations/instrumento";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CUATRO REGLAS DEL MODULO S  ·  v15 §2.3, §2.7, §7.2 y §7.3
//
// Son reglas de Gildardo sobre lo que se le pregunta a un paciente y sobre si su medicion entra a un
// analisis. Cada una tiene un error facil que no falla en voz alta, y cada caso de aqui existe por uno
// de ellos: el O donde el escribio un Y, el salto que deja huecos, el item 38 que no vuelve nunca, y la
// adherencia que se declara insuficiente sobre una encuesta a medias.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const DOS_PRODUCTOS = { "prod-a": "Todos los días", "prod-b": "5 o más días por semana" };

describe("la adherencia: las DOS mitades de su regla", () => {
  it("adecuada cuando los productos van bien Y el plan tambien", () => {
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: "Todo", s4: [] })).toBe(true);
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: "Casi todo", s4: [] })).toBe(true);
  });

  it("y basta UN producto flojo para que no lo sea", () => {
    expect(
      adherenciaAdecuada({
        s1: { ...DOS_PRODUCTOS, "prod-c": "Menos de 5 días por semana" },
        s3: "Todo",
        s4: [],
      }),
      "su regla dice «para todos los indicados»",
    ).toBe(false);
  });

  it("y el plan flojo tambien la tumba, aunque los productos vayan perfecto", () => {
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: "La mitad", s4: [] })).toBe(false);
  });

  it("SIN NINGUN PRODUCTO INDICADO se decide solo con el S3, que es la decision 34", () => {
    // Su razon esta medida: de los 30 pacientes con dos o mas consultas, 18 no tienen ningun
    // nutraceutico en la anterior. Exigir el S1 ahi dejaria a la mayoria sin adherencia calculable, y
    // `cnvsAdherenciaAdecuada` es uno de los dos ejes de su tabla 6.
    expect(adherenciaAdecuada({ s1: null, s3: "Todo", s4: [] })).toBe(true);
    expect(adherenciaAdecuada({ s1: {}, s3: "Poco", s4: [] })).toBe(false);
  });

  it("y SIN S3 no se dice nada: null, no «insuficiente»", () => {
    // Declarar insuficiente sobre una encuesta a medias le atribuye al paciente algo que no dijo, y su
    // tabla 6 cruzaria el delta con un eje inventado.
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: null, s4: [] })).toBeNull();
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: "  ", s4: [] })).toBeNull();
  });

  it("las cinco opciones del S1 son las suyas, en su orden", () => {
    expect([...S1_OPCIONES]).toEqual([
      "Todos los días",
      "5 o más días por semana",
      "Menos de 5 días por semana",
      "No lo tomó",
      "Lo suspendió",
    ]);
  });
});

describe("la medicion no comparable: SUS TRES eventos, no los seis", () => {
  it("los tres que el nombra la vuelven no comparable", () => {
    for (const e of [
      "Enfermedad aguda (fiebre, infección, diarrea)",
      "Hospitalización o cirugía",
      "Embarazo o lactancia",
    ]) {
      expect(medicionComparable({ s1: null, s3: "Todo", s4: [e] }), e).toBe(false);
    }
  });

  it("y los otros tres NO, que es donde esta el error facil", () => {
    // Un medicamento nuevo, un cambio de turno o un evento estresante son contexto que el profesional
    // tiene que ver, pero no invalidan la bioimpedancia. Metidos aqui, casi nadie entraria al delta y la
    // tarjeta de seguimiento no compararia nunca.
    for (const e of ["Medicamento nuevo", "Cambio de turno o de trabajo", "Evento estresante mayor"]) {
      expect(medicionComparable({ s1: null, s3: "Todo", s4: [e] }), e).toBe(true);
    }
  });

  it("sin S4 respondido, comparable: lo que la encuesta no dice no es un evento", () => {
    expect(medicionComparable({ s1: null, s3: null, s4: null })).toBe(true);
    expect(medicionComparable({ s1: null, s3: null, s4: ["Ninguno"] })).toBe(true);
  });
});

describe("el salto de los sintomas digestivos: sus DOS condiciones son un Y", () => {
  const SIETE = ["d6_45", "d6_46", "d6_47", "d6_48", "d6_49", "d6_50", "d6_51"];
  const todasNunca = Object.fromEntries(SIETE.map((k) => [k, "Nunca"]));

  it("se salta con «No» hoy Y los siete en «Nunca» la vez pasada", () => {
    const r = saltoDeLosDigestivos("No", todasNunca, SIETE);
    expect(r.seSalta).toBe(true);
    // Y SE GUARDAN LOS SIETE: un salto que deja huecos convierte una regla de ahorro en una encuesta
    // incompleta, y el gate del diagnostico la frenaria.
    expect(r.seSalta && r.seGuardan).toEqual(Array(7).fill("Nunca"));
  });

  it("NO se salta con «No» hoy si la vez pasada habia algun sintoma", () => {
    // Es el error de escribirlo como un O: se saltarian los siete de un paciente que la vez pasada tenia
    // reflujo frecuente, y su historia diria "Nunca" sobre un sintoma que nadie volvio a preguntar.
    const conReflujo = { ...todasNunca, d6_50: "Frecuente" };
    expect(saltoDeLosDigestivos("No", conReflujo, SIETE).seSalta).toBe(false);
  });

  it("no se salta con «Sí», aunque la vez pasada fueran todas nunca", () => {
    expect(saltoDeLosDigestivos("Sí", todasNunca, SIETE).seSalta).toBe(false);
  });

  it("no se salta sin consulta anterior, ni si falta alguno de los siete", () => {
    expect(saltoDeLosDigestivos("No", null, SIETE).seSalta).toBe(false);
    const faltaUno = { ...todasNunca };
    delete (faltaUno as Record<string, string>).d6_48;
    expect(saltoDeLosDigestivos("No", faltaUno, SIETE).seSalta).toBe(false);
  });

  it("y sin responder el filtro no se salta: no hay con que decidirlo", () => {
    expect(saltoDeLosDigestivos(null, todasNunca, SIETE).seSalta).toBe(false);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // PERO MIENTRAS EL FILTRO ESTE SIN RESPONDER, SI EL SALTO PUEDE APLICAR, LOS SIETE NO SE PRESENTAN
  //
  // (Santiago, 2026-11-09, al revisar el smoke.) Antes se presentaban desde el primer momento y se
  // recogian al responder «No», asi que el paciente veia aparecer y desaparecer siete preguntas: se lee
  // como que la pantalla se equivoco, y quien ya habia empezado a contestarlas pierde lo que llevaba.
  //
  // LA DISTINCION ES LO QUE LO HACE CORRECTO: «no se salta» y «no se presenta todavia» son dos cosas, y
  // solo se espera cuando responder el filtro puede cambiar algo. Si el salto no es posible (la vez
  // pasada hubo algun sintoma), esperar seria esconder siete preguntas por nada.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("no se presentan mientras falte el filtro, si la vez pasada fueron las siete «Nunca»", () => {
    const r = saltoDeLosDigestivos(null, todasNunca, SIETE);
    expect(r.seSalta).toBe(false);
    expect(r.seSalta === false && r.sePresentan).toBe(false);
    expect(r.seSalta === false && r.motivo).toBe("falta el filtro");
  });

  it("pero si el salto NO puede aplicar, se presentan desde el principio", () => {
    const conReflujo = { ...todasNunca, d6_50: "Frecuente" };
    const r = saltoDeLosDigestivos(null, conReflujo, SIETE);
    expect(r.seSalta === false && r.sePresentan).toBe(true);
    // Y sin consulta anterior, igual: no hay nada que pueda saltarse.
    expect(
      (() => {
        const sin = saltoDeLosDigestivos(null, null, SIETE);
        return sin.seSalta === false && sin.sePresentan;
      })(),
    ).toBe(true);
  });

  it("y cuando el salto manda, no se presentan Y se guardan los siete", () => {
    const r = saltoDeLosDigestivos("No", todasNunca, SIETE);
    expect(r.seSalta && r.sePresentan === false).toBe(true);
  });
});

describe("la reconfirmacion anual, y el item 38 que vuelve con ella", () => {
  it("un año o mas, con el corte CERRADO como el lo escribio", () => {
    expect(tocaReconfirmacionAnual("2025-11-07", "2026-11-07")).toBe(true);
    expect(tocaReconfirmacionAnual("2026-01-01", "2026-11-07")).toBe(false);
  });

  it("sin confirmacion completa anterior no toca, y no se inventa una", () => {
    expect(tocaReconfirmacionAnual(null, "2026-11-07")).toBe(false);
  });

  it("EL ITEM 38 VUELVE SOLO EN LA RECONFIRMACION, y es el unico retirado que vuelve", () => {
    // En una CNV-S normal el 38 (antecedentes familiares) esta RETIRADO por su tabla 3, asi que no se
    // pregunta nunca. Sin esto, los antecedentes familiares de un paciente se preguntarian UNA VEZ en su
    // vida, y la reconfirmacion anual existe justo para eso.
    const OCHO = ["d3_28", "d4_34", "d5_39", "d5_40", "d5_42", "d6_43", "d6_44", "d8_59"];
    expect(clavesAConfirmar(OCHO, false)).not.toContain(CLAVE_ANTECEDENTES_FAMILIARES);
    expect(clavesAConfirmar(OCHO, true)).toContain(CLAVE_ANTECEDENTES_FAMILIARES);
    expect(clavesAConfirmar(OCHO, true)).toHaveLength(9);
    // Y no se duplica si ya estuviera en la lista.
    expect(clavesAConfirmar([...OCHO, CLAVE_ANTECEDENTES_FAMILIARES], true)).toHaveLength(9);
  });
});

describe("a quien se le aplica la CNV-S, y a quien NO puede aplicarse", () => {
  it("UN PACIENTE REAL NO LA RECIBE mientras no este aprobada. Es LA propiedad de seguridad", () => {
    // Si este caso se pone en rojo, alguien le esta aplicando a una persona real un cuestionario que
    // Gildardo no ha aprobado, y lo primero que pierde son los cuatro items retirados: no se le
    // preguntan y no hay linea base previa que conserve su valor.
    expect(CNVS_ACTIVA, "la CNV-S se aprobo para pacientes reales sin decirlo aqui").toBe(false);
    expect(
      instrumentoParaLaConsulta("seguimiento", false),
      "un paciente REAL recibiria la CNV-S sin aprobacion",
    ).toBe("CNV v2.0");
  });

  it("UNA INICIAL NUNCA es CNV-S, pase lo que pase con los interruptores", () => {
    // Es su §2.1 y no admite excepcion: sin linea base no hay nada que confirmar ni contra que comparar.
    // Y es la puerta que va PRIMERA, antes de mirar ninguna bandera.
    expect(instrumentoParaLaConsulta("inicial", false)).toBe("CNV v2.0");
    expect(instrumentoParaLaConsulta("inicial", true)).toBe("CNV v2.0");
  });

  it("y un SEGUIMIENTO DE UN PACIENTE DE PRUEBA si la recibe, que es el modo pruebas", () => {
    // Santiago, 2026-11-08: *"En producción, la CNV-S se aplica SOLO a pacientes de prueba, no con un
    // interruptor global."* La puerta es `cuenta_como_de_prueba`, que incluye la DERIVADA (todo paciente
    // de un profesional marcado de prueba), no `is_test` a secas.
    expect(CNVS_EN_PRUEBAS, "el modo pruebas se apago: el smoke en la nube deja de funcionar").toBe(true);
    expect(instrumentoParaLaConsulta("seguimiento", true)).toBe("CNV-S 1.0");
  });

  it("EL ENVIO RESUELVE EL INSTRUMENTO, que era el cable que faltaba", () => {
    // Sin esto, `getActiveSurvey()` sin codigo devolvia siempre la linea base y `readAnswersFromForm`
    // descartaba las respuestas del Modulo S: el paciente las contesta y no se guardan, sin un error.
    const ACCIONES = sinComentarios(readFileSync("src/modules/evaluations/actions.ts", "utf8"));
    expect(ACCIONES, "el envio volvio a pedir siempre la linea base").not.toMatch(
      /getActiveSurvey\(\)/,
    );
    expect(ACCIONES).toContain("getActiveSurvey(await instrumentoPorTokenDeEncuesta(resumeToken))");
  });

  it("Y LA VISTA DEL PROFESIONAL SE ENSAMBLA POR EL INSTRUMENTO, o el Modulo S queda invisible", () => {
    // ═══ EL DEFECTO, QUE NO ES UNA SUPOSICION ═══
    //
    // La respuesta sella la version del CUESTIONARIO (nunca la del Modulo S: con esa, el diagnostico
    // creeria que la encuesta tiene siete campos). Y esta lectura pedia las preguntas DE ESA VERSION,
    // asi que las siete respuestas del Modulo S quedaban GUARDADAS Y SIN PANTALLA: adherencia, eventos
    // del S4 y sintomas digestivos contestados por el paciente y ausentes de la pestaña Evaluacion, de
    // la historia clinica, del SOAP y del CSV, que leen todos de aqui.
    //
    // Y SE ARMA CON `getActiveSurvey`, el MISMO lector que pinto el formulario del paciente: armar la
    // lista por segunda vez es como la vista del profesional acaba numerando distinto, y entonces
    // "pregunta 38" deja de ser la misma pregunta en las dos pantallas.
    const LECTOR = sinComentarios(
      readFileSync("src/modules/evaluations/data/survey-answers-reader.ts", "utf8"),
    );
    expect(LECTOR, "la vista volvio a leer solo la version sellada").toContain(
      "instrumentoDeLaConsulta(evaluationId)",
    );
    expect(LECTOR).toContain("codigo !== CODIGO_LINEA_BASE");
    expect(LECTOR, "la vista arma el instrumento por su cuenta en vez de reusar el lector").toContain(
      "getActiveSurvey(codigo)",
    );
    // Y LA NUMERACION SIGUE SALIENDO DE LA MISMA FUNCION PURA que la linea base.
    expect(LECTOR).toContain("groupSurveyAnswers(questions,");
  });

  it("LOS `retirar` SE HEREDAN EN EL ENVIO, o la consulta CNV-S nace sin ellos", () => {
    // ═══ EL DEFECTO MEDIDO, Y HABRIA TUMBADO EL PRIMER SMOKE ═══
    //
    // El formulario filtra los cuatro `retirar` (no se vuelven a preguntar, su tabla 3) y su comentario
    // decia que llegaban "para que el envio sepa cuales arrastrar"... y nadie los arrastraba. Una de las
    // cuatro, `d5_38`, tiene `used_in_diagnosis = true`: sin heredarla, TODA consulta CNV-S sale con
    // "Encuesta incompleta: faltan 1 de 29 respuestas que usa el diagnostico" y el gate la frena.
    const SERVICIO = sinComentarios(
      readFileSync("src/modules/evaluations/services/survey-intake.ts", "utf8"),
    );
    expect(SERVICIO, "el envio dejo de heredar los `retirar`").toContain("retiradosHeredados({");
    expect(SERVICIO).toContain("answers: [...answers.data, ...heredadas]");
    // Y EL AUTOGUARDADO NO LOS HEREDA: es un borrador que el paciente sigue moviendo.
    const guardado = SERVICIO.slice(
      SERVICIO.indexOf("export async function saveProgress"),
      SERVICIO.indexOf("export async function submitSurveyAnswers"),
    );
    expect(guardado, "el autoguardado empezo a heredar los retirados").not.toContain(
      "retiradosHeredados",
    );
  });

  it("y lo heredado NO pisa lo que el paciente contesto hoy, ni se inventa lo que no existe", () => {
    const LECTOR = sinComentarios(
      readFileSync("src/modules/evaluations/data/retirados-heredados.ts", "utf8"),
    );
    expect(LECTOR).toContain("if (input.yaRespondidas.has(q.id)) continue;");
    expect(LECTOR, "un item sin respuesta anterior se rellenaria con un valor inventado").toContain(
      'if (valor === "") continue;',
    );
    // Y en la linea base no cuesta ni una consulta: sin instrumento sellado, se va de inmediato.
    expect(LECTOR).toContain("if (!ev?.instrumentoId) return [];");
  });

  it("y la pantalla de la encuesta DICE con que instrumento se recogio", () => {
    // Sin esto, la trazabilidad del instrumento existe solo en una columna: nadie puede comprobar en
    // pantalla si a esa consulta se le aplico la CNV-S o la encuesta completa.
    const PAGINA = readFileSync("src/app/(app)/ani-bis-e/[id]/encuesta/page.tsx", "utf8");
    expect(PAGINA).toContain("instrumentoDeLaConsulta(id)");
    expect(PAGINA).toContain("Instrumento: ${instrumento}");
  });

  it("y las TRES pantallas resuelven el mismo instrumento que el envio", () => {
    // El defecto que esto vigila no es que una falle: es que la pantalla pinte un cuestionario y el
    // envio guarde otro. Ninguna de las dos daria error.
    for (const f of [
      "src/app/(app)/ani-bis-e/[id]/responder-encuesta/page.tsx",
      "src/app/(public)/encuesta/reanudar/[token]/page.tsx",
      "src/app/(public)/encuesta/[token]/page.tsx",
    ]) {
      const s = sinComentarios(readFileSync(f, "utf8"));
      expect(s, `${f} volvio a pedir la encuesta sin instrumento`).not.toMatch(/getActiveSurvey\(\)/);
    }
  });

  it("y las tres pantallas pasan los INSUMOS de la CNV-S, no solo sus preguntas", () => {
    // ═══ EL MISMO DEFECTO, UN NIVEL MAS ABAJO ═══
    //
    // El formulario pinta el bloque de confirmacion, el S1 por producto y el filtro digestivo SOLO si
    // recibe `cnvs`. Sin ese prop no falla: cae al widget normal, asi que los ocho items a confirmar
    // saldrian en blanco (sin "la vez pasada respondiste"), el S1 no pintaria ningun producto y el salto
    // digestivo no se aplicaria nunca. Una CNV-S que se ve como la encuesta completa.
    for (const f of [
      "src/app/(app)/ani-bis-e/[id]/responder-encuesta/page.tsx",
      "src/app/(public)/encuesta/reanudar/[token]/page.tsx",
      "src/app/(public)/encuesta/[token]/page.tsx",
    ]) {
      const s = sinComentarios(readFileSync(f, "utf8"));
      expect(s, `${f} no lee los insumos de la CNV-S`).toContain("insumosDeLaCnvs(");
      expect(s, `${f} no se los pasa al formulario`).toContain("cnvs={cnvs}");
    }
  });

  it("y los insumos se leen SOLO con el instrumento de seguimiento", () => {
    // Con la linea base no hay nada que confirmar: la consulta de la anterior seria trabajo tirado en
    // cada carga de la encuesta de cada paciente.
    for (const f of [
      "src/app/(app)/ani-bis-e/[id]/responder-encuesta/page.tsx",
      "src/app/(public)/encuesta/reanudar/[token]/page.tsx",
      "src/app/(public)/encuesta/[token]/page.tsx",
    ]) {
      const s = sinComentarios(readFileSync(f, "utf8"));
      expect(s, `${f} lee los insumos sin mirar el instrumento`).toContain(
        "survey.instrumento.codigo === CODIGO_SEGUIMIENTO",
      );
    }
  });

  it("y el instrumento lo decide UNA sola funcion, no cada pantalla", () => {
    // Si cada pantalla resolviera su instrumento, el dia que la regla cambie habria que encontrarlas
    // todas, y la que se quede atras aplicaria OTRO cuestionario sin que nada fallara.
    const FUENTE = sinComentarios(readFileSync("src/modules/evaluations/instrumento.ts", "utf8"));
    expect(FUENTE).toContain("export function instrumentoParaLaConsulta");
    expect(FUENTE).toContain("export const CNVS_ACTIVA = false;");
  });

  it("EL SELLO MANDA SOBRE LA DEDUCCION: los lectores leen la columna, no el tipo de consulta", () => {
    // ═══ EL CASO DEL ENLACE GENERICO DEL CONSULTORIO ═══
    //
    // La encuesta publica se sirve en UNA carga. Con el enlace generico, la cedula se escribe DESPUES de
    // pintar la pagina, asi que la consulta puede acabar siendo un seguimiento mientras el paciente vio
    // la encuesta completa. Un lector que dedujera el instrumento del tipo de la consulta le pondria a
    // esa respuesta la etiqueta de un instrumento que nunca se mostro: un dato FALSO, no uno que falta.
    const LECTOR = sinComentarios(
      readFileSync("src/modules/evaluations/data/instrumento-de-la-consulta.ts", "utf8"),
    );
    expect(LECTOR).toContain("evaluations.surveyInstrumentId");
    // Y los dos lectores por consulta NO vuelven a mirar si el paciente es de prueba: eso se decidio al
    // sellar. Mirarlo otra vez al leer significaria que marcar un paciente de prueba HOY cambiaria el
    // instrumento de una encuesta que ya se contesto.
    const porToken = LECTOR.slice(LECTOR.indexOf("export async function instrumentoPorTokenDeEncuesta"));
    expect(porToken, "el lector volvio a deducir el instrumento").not.toContain("cuentaComoDePrueba");
  });

  it("y la respuesta hereda el instrumento DE LA CONSULTA, no uno resuelto al escribir", () => {
    const WRITER = sinComentarios(
      readFileSync("src/modules/evaluations/data/intake-writer.ts", "utf8"),
    );
    expect(WRITER).toContain("instrumentoId: evaluations.surveyInstrumentId");
    expect(WRITER, "el writer volvio a resolver el instrumento por su cuenta").not.toContain(
      "surveyInstruments.codigo",
    );
  });
});
