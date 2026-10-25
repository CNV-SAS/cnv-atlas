import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EL CASO 6 CORRIGE SIN ARRASTRAR LA MEDICION, Y SIN BORRAR NADA
//
// ── DE DONDE SALE ───────────────────────────────────────────────────────────────────────────────
//
// `docs/PLAN_FLUJO_CORRECCION.md` aparto el caso 6 ("Biody del paciente equivocado") el primer dia y
// nunca se construyo. El barrido del 2026-10-24 encontro 10 grupos reales, 4 entre pacientes DISTINTOS.
// Santiago: *"Construye: el trigger_type nuevo, corregir SIN arrastrar la medicion (la version nueva nace
// sin BIS y su puerta dice 'Montar BIS'), y marcar la medicion huerfana para que el freno no bloquee al
// dueno real."*
//
// ── LO QUE DEFIENDE, Y POR QUE CADA COSA SE PUEDE ROMPER SIN QUE SE NOTE ────────────────────────
//
//   1. LA MEDICION NO VIAJA. Es la unica diferencia que define este flujo frente a `correctEvaluation`,
//      que la copia y verifica que la copia sea identica. El dia que alguien "unifique" los dos
//      servicios, lo primero que se cuela es la copia, y entonces el error se propaga a la version nueva
//      con cara de corregido.
//   2. NO SE BORRA NADA. Ni la medicion, ni el diagnostico sellado. Un `delete` aqui seria perder la
//      evidencia de lo que se le emitio a un paciente.
//   3. LA MARCA SE PONE, Y EN LA MISMA TRANSACCION. Si la correccion ocurre y la marca no, el freno de la
//      0225 queda armado contra el DUENO DE VERDAD, que es el defecto entero que esto viene a evitar. Y
//      eso no da ningun error: se descubre cuando el otro paciente no puede cargar su archivo.
//   4. EL FRENO MIRA LA MARCA. La otra mitad de lo mismo, en el otro archivo.
//   5. NO CORRE EL MOTOR. La version nueva nace sin medicion, asi que no hay nada que diagnosticar.
//      Llamar al pipeline aqui seria diagnosticar sin medicion o reventar.
//   6. EL DISPARADOR ES PROPIO. Reusar `correccion_profesional` enterraria un incidente de datos de salud
//      entre las correcciones de un decimal.
//   7. LO DECIDE EL PROFESIONAL ASIGNADO, NO ADMIN (lectura de Santiago; misma regla que corregir).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const SERVICIO = "src/modules/corrections/services/corregir-medicion-de-otro-paciente.ts";
const FRENO = "src/modules/bis/data/medicion-duplicada-reader.ts";
const PANTALLA = "src/modules/corrections/components/medicion-de-otro-paciente.tsx";
const ACCIONES = "src/modules/corrections/actions.ts";
const PENDIENTES = "src/modules/patients/pendientes.ts";
const MIGRACION = "drizzle/0226_la_medicion_de_otro_paciente.sql";

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

describe("la version nueva nace SIN la medicion", () => {
  const src = leer(SERVICIO);

  it("no inserta en bis_measurements ni en bis_raw_values", () => {
    expect(
      /insert\(bisMeasurements\)/.test(src),
      "copiar la medicion es propagar el error a la version nueva: es lo contrario de este flujo",
    ).toBe(false);
    expect(/insert\(bisRawValues\)/.test(src)).toBe(false);
  });

  it("no corre el motor ni el pipeline: sin medicion no hay nada que diagnosticar", () => {
    expect(/runEngine|computeProtocolo|writePipeline/.test(src)).toBe(false);
  });

  it("no borra nada, ni la medicion ni el diagnostico", () => {
    expect(
      /\.delete\(/.test(src),
      "nada se borra en una historia clinica: la version vieja queda reemplazada y legible",
    ).toBe(false);
  });

  it("la encuesta, la fuerza prensil y el peso meta SI viajan", () => {
    // Son datos DE ESTE PACIENTE. La fuerza prensil es la que mas facil se pierde aqui, y se perderia en
    // silencio: la mide el profesional con su dinamometro y vive en la fila del intake, no en la medicion.
    expect(/insert\(surveyAnswers\)/.test(src), "las respuestas son del paciente").toBe(true);
    expect(/gripStrengthKg: oldIntake\.gripStrengthKg/.test(src)).toBe(true);
    expect(/weightGoalKg: oldIntake\.weightGoalKg/.test(src)).toBe(true);
  });

  it("las condiciones se conservan y vuelven a quedar PENDIENTES", () => {
    // El contenido se conserva porque describe al paciente (el marcapasos es suyo, y bajar esa compuerta
    // seria peligroso); el SELLO se suelta porque describe un momento que no era este.
    expect(/contraindicated: oldIntake\.contraindicated/.test(src)).toBe(true);
    expect(/conditionsRegisteredAt: null/.test(src)).toBe(true);
  });

  it("la version nueva nace in_progress, que es lo que hace que su puerta diga Montar BIS", () => {
    expect(/status: "in_progress"/.test(src)).toBe(true);
    // Y la regla que lo dice ya existe: no hace falta un caso nuevo en la secuencia.
    expect(/!e\.tieneBis[\s\S]*Montar BIS/.test(leer(PENDIENTES))).toBe(true);
  });
});

describe("la marca y la correccion van juntas o no van", () => {
  const src = leer(SERVICIO);

  it("todo dentro de UNA transaccion, y ninguna escritura por fuera", () => {
    const i = src.indexOf("db.transaction(async (tx) =>");
    expect(i, "el flujo entero va en una transaccion").toBeGreaterThan(-1);
    const antes = src.slice(0, i);
    const dentro = src.slice(i);

    // Las cuatro escrituras que no pueden separarse estan DENTRO y van por `tx`.
    for (const pieza of [
      "insert(evaluations)",
      "update(bisMeasurements)",
      "insert(clinicalCorrections)",
      "recordAudit(tx,",
    ]) {
      expect(dentro.includes(pieza), `${pieza} tiene que estar dentro de la transaccion`).toBe(true);
      expect(antes.includes(pieza), `${pieza} no puede quedar fuera de la transaccion`).toBe(false);
    }
    expect(
      /\bdb\s*\.\s*(insert|update|delete)\(/.test(src),
      "una escritura por `db` quedaria fuera de la transaccion: la marca y la correccion se separarian",
    ).toBe(false);
  });

  it("si la marca no quedo puesta, la correccion REVIERTE en voz alta", () => {
    expect(
      /marcadas\.length !== 1/.test(src) && /throw new Error\(/.test(src),
      "una correccion sin la marca deja el freno armado contra el dueno de verdad, y sin ningun error",
    ).toBe(true);
  });

  it("la marca se pone solo si no estaba, para que dos pulsaciones no se pisen", () => {
    expect(/isNull\(bisMeasurements\.noEsDelPacienteAt\)/.test(src)).toBe(true);
  });

  it("el disparador es el propio, no el de corregir un dato", () => {
    expect(/triggerType: "medicion_de_otro_paciente"/.test(src)).toBe(true);
  });

  it("superseded_at NO se escribe a mano: lo pone el trigger de la 0030", () => {
    // Se LEE (para rechazar una version ya reemplazada) y no se ESCRIBE: el unico escritor es el trigger
    // `clinical_corrections_apply`, y el de coherencia rechazaria un valor sin correccion que lo respalde.
    expect(/update\(evaluations\)/.test(src)).toBe(false);
    expect(/supersededAt: (new Date|sql|now)/.test(src)).toBe(false);
  });

  it("la auditoria es un evento PROPIO y va inline (regla dura 8)", () => {
    expect(/event: "evaluation\.medicion_de_otro_paciente"/.test(src)).toBe(true);
    expect(/recordAudit\(tx,/.test(src)).toBe(true);
  });
});

describe("el freno de la 0225 mira la marca", () => {
  it("excluye las mediciones que constan como de otro paciente", () => {
    expect(
      /isNull\(bisMeasurements\.noEsDelPacienteAt\)/.test(leer(FRENO)),
      "sin esto el freno le dice al paciente CORRECTO que su medicion es de otro",
    ).toBe(true);
  });

  it("y sigue siendo una excepcion NOMBRADA, no 'las reemplazadas no cuentan'", () => {
    const src = leer(FRENO);
    expect(
      /supersededAt|superseded_at/.test(src),
      "ignorar toda evaluacion reemplazada seria un permiso general: dejaria pasar reimportaciones",
    ).toBe(false);
  });
});

describe("quien lo decide, y que se lee antes de pulsar", () => {
  it("el profesional asignado, y admin NO", () => {
    const src = leer(SERVICIO);
    expect(/prof\.id !== ev\.professionalId/.test(src)).toBe(true);
    expect(
      /requireAdmin|has_role\('admin'\)/.test(src),
      "es un acto clinico: decir de quien es una medicion es leer la consulta",
    ).toBe(false);
  });

  it("solo sobre la version vigente: la cadena no se bifurca", () => {
    expect(/ev\.supersededAt/.test(leer(SERVICIO))).toBe(true);
  });

  it("el motivo es obligatorio y pide una frase, no una palabra", () => {
    expect(/min\(15/.test(leer(ACCIONES))).toBe(true);
  });

  it("la confirmacion viaja en una casilla con name, no en el value del boton (hazard 5)", () => {
    const src = leer(PANTALLA);
    const casilla = src.match(/<input\s+type="checkbox"[\s\S]*?\/>/)?.[0] ?? "";
    expect(casilla).toContain('name="confirmar"');
    expect(/<Button type="submit"[^>]*value=/.test(src)).toBe(false);
  });

  it("el envio no resetea el formulario (hazard 2): un error no borra el motivo escrito", () => {
    const src = leer(PANTALLA);
    expect(/enviarSinReset\(action\)/.test(src)).toBe(true);
    expect(/<form action=\{/.test(src)).toBe(false);
  });

  it("el boton apagado DICE que le falta (hazard 8)", () => {
    const crudo = readFileSync(PANTALLA, "utf8");
    expect(/Escribe el motivo para continuar/.test(crudo)).toBe(true);
    expect(/Marca la confirmación para continuar/.test(crudo)).toBe(true);
  });

  it("la pantalla explica las TRES consecuencias, incluida la que no es evidente", () => {
    const crudo = readFileSync(PANTALLA, "utf8");
    expect(/reemplazada/.test(crudo), "que esta version queda reemplazada").toBe(true);
    expect(/Montar BIS/.test(crudo), "que la nueva nace sin medicion").toBe(true);
    expect(
      /deja al paciente dueño cargar su propio archivo/.test(crudo),
      "la consecuencia menos evidente y la mas importante: sin la marca el freno se le cierra al correcto",
    ).toBe(true);
  });

  it("el bloque de corregir ya no manda a soporte por la medicion", () => {
    const entry = readFileSync("src/modules/corrections/components/correction-entry.tsx", "utf8");
    expect(
      /la medición del equipo y la\s+identidad del paciente no se corrigen/.test(entry),
      "ese texto describia un camino que ya existe, en la misma pantalla",
    ).toBe(false);
  });
});

describe("la migracion deja la marca coherente y sin vuelta atras", () => {
  const sql = readFileSync(MIGRACION, "utf8");

  it("agrega el disparador al enum sin tocar los que ya estaban (forward-only)", () => {
    expect(/ALTER TYPE "public"\."correction_trigger_type" ADD VALUE 'medicion_de_otro_paciente'/.test(sql)).toBe(true);
    expect(/DROP TYPE/.test(sql)).toBe(false);
  });

  it("las tres columnas de la marca viajan juntas (CHECK)", () => {
    expect(/ADD CONSTRAINT "bis_measurements_no_es_del_paciente_coherente" CHECK/.test(sql)).toBe(true);
    expect(/btrim\(COALESCE\("no_es_del_paciente_motivo", ''\)\) <> ''/.test(sql)).toBe(true);
  });

  it("la marca es write-once por trigger", () => {
    expect(/bis_measurements_marca_ajena_write_once/.test(sql)).toBe(true);
    expect(/BEFORE UPDATE ON bis_measurements/.test(sql)).toBe(true);
  });
});
