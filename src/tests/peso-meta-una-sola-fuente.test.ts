import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { computeProtocoloEfectivo, type ProtocoloAjustes } from "@/clinical-engine";
import type { ProtocoloSnapshot } from "@/clinical-engine/protocolo";

// CANDADO DEL PESO META COMO UN SOLO DATO, EN UN SOLO SITIO (Gildardo, 2026-08-28 §2).
//
// SU INSTRUCCION, textual: "el campo va en la entrada, en mod antropometría... no son dos pesos meta, es
// uno. El campo de la entrada y el ajuste del tratamiento son el mismo dato en dos superficies de edición,
// no dos datos que puedan discrepar. SI LOS CONSTRUYEN COMO CAMPOS SEPARADOS, EL DEFECTO LO CREAN USTEDES."
// Y de donde sale: "el peso meta no pertenece al tratamiento, pertenece al paciente. El motor lo calcula
// como punto de partida, el profesional lo fija, y el tratamiento lo LEE. No lo crea."
//
// EL DEFECTO QUE CIERRA, EN DOS MITADES:
//
// 1 · (2026-08-31) La superficie de la entrada existia desde la migracion 0021
//     (`evaluation_bis_intake.weight_goal_kg`), con su input vivo, y NO LA LEIA NADIE. Ni la cadena
//     calorica, ni el sellado al aprobar, ni el prompt del menu. El profesional acordaba un peso meta con
//     el paciente, lo escribia, y la prescripcion no se movia ni un gramo. Es la misma familia que el
//     motor portado y no conectado y que la dinamometria capturada y no cableada: una pieza TERMINADA a la
//     que le falta el ultimo cable, que es la que no da error en ninguna parte.
//
// 2 · (2026-09-01, migracion 0095) Conectada, seguian siendo DOS columnas que podian decir numeros
//     distintos. Eso es literalmente lo que el advirtio. Ahora hay UNA, y la resolucion que el paso
//     intermedio hacia en el lector desaparecio: no hay nada que resolver. Un helper por el que todos
//     tienen que acordarse de pasar es mas fragil que no tener dos fuentes.
//
// LO QUE NO SE PERDIO AL UNIFICAR: de cual de las dos superficies salio el numero. No es metadato, es
// informacion clinica: no es lo mismo el peso acordado con el paciente en la consulta que uno ajustado
// despues, al armar el plan.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const READER = readFileSync("src/modules/treatment/data/treatment-reader.ts", "utf8");
const WRITER = readFileSync("src/modules/treatment/data/treatment-writer.ts", "utf8");
const INTAKE_WRITER = readFileSync("src/modules/bis-intake/data/bis-intake-writer.ts", "utf8");
const MENU = readFileSync("src/modules/treatment/services/generate-menu.ts", "utf8");
const CAPTURA = readFileSync("src/modules/bis-intake/components/bis-conditions-capture.tsx", "utf8");
const MIGRACION = readFileSync("drizzle/0095_peso_meta_una_sola_fuente.sql", "utf8");
const MUDANZA = readFileSync("drizzle/0096_peso_meta_en_la_evaluacion.sql", "utf8");
const CORRECCION = readFileSync("src/modules/corrections/services/correct-evaluation.ts", "utf8");
const FIRMA = readFileSync("src/modules/treatment/data/protocol-signature.ts", "utf8");

/** El codigo sin comentarios: los comentarios CITAN lo que el candado prohibe, para explicar por que. */
function quitarComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("hay UN solo sitio de guardado, y es el del paciente", () => {
  it("nadie lee ni escribe `adj_peso_meta`: quedó supersedida", () => {
    // La columna no se borra (forward-only, y es el registro de lo que el tratamiento tuvo antes de la
    // unificacion), pero volver a leerla reabriria las dos fuentes que la 0095 cerro. Se mira el codigo
    // sin comentarios: la migracion y los comentarios la NOMBRAN, que es justo lo que hay que conservar.
    const fuentes: [string, string][] = [
      ["reader", READER],
      ["writer", WRITER],
      ["panel", PANEL],
      ["menú", MENU],
    ];
    for (const [nombre, src] of fuentes) {
      expect(quitarComentarios(src), `${nombre} volvió a tocar adj_peso_meta`).not.toContain("adj_peso_meta");
      expect(quitarComentarios(src), `${nombre} volvió a tocar adjPesoMeta`).not.toContain("adjPesoMeta");
    }
  });

  it("la base también lo dice, que es donde lo va a leer quien abra la tabla", () => {
    // Un comentario en el codigo no llega a quien inspecciona la tabla. Una columna viva que nadie escribe
    // es la otra cara del campo que nadie lee, y sin este COMMENT parece que sigue siendo el sitio.
    expect(MIGRACION).toContain('COMMENT ON COLUMN "treatments"."adj_peso_meta"');
    expect(MIGRACION).toContain("SUPERSEDIDA");
  });

  it("el panel, el sellado y el menú leen ese único sitio", () => {
    expect(READER).toContain("pesoMetaFijado: intake.data?.weight_goal_kg");
    expect(READER).toContain("pesoMeta: n(intake?.weight_goal_kg)");
    expect(MENU).toContain("pesoMeta: protocol.pesoMetaFijado");
    // Y el panel no resuelve nada: si volviera a haber un helper de resolucion, es que volvieron las dos.
    expect(quitarComentarios(PANEL)).not.toContain("function pesoMetaFijado(");
  });
});

describe("la migración copia lo que ya existía, sin cambiarle la prescripción a nadie", () => {
  it("el ajuste del tratamiento GANA sobre el de la entrada", () => {
    // No es jerarquia, es continuidad: hasta la 0095 la cadena resolvia `adj_peso_meta ?? weight_goal_kg`,
    // asi que el del tratamiento es el que gobierna ESE plan ahora mismo. Que ganara el otro cambiaria
    // calorias y gramos de proteina de planes vivos, en silencio. Una migracion de datos no prescribe.
    expect(MIGRACION).toContain('SET "weight_goal_kg" = t.adj_peso_meta');
    expect(MIGRACION).toContain("Una migracion de datos no prescribe");
  });

  it("y FALLA en vez de perder un peso meta sin destino", () => {
    // Si un tratamiento tiene peso meta y su evaluacion no tiene fila de intake, la copia lo dejaria caer
    // en silencio. El valor gobierna las calorias de un plan vivo: la migracion revienta y se resuelve a
    // mano. (No puede crearse la fila: `bis_condition_version_id` y `condition_answers` son NOT NULL.)
    expect(MIGRACION).toContain("RAISE EXCEPTION");
    expect(MIGRACION).toContain("sin fila de evaluation_bis_intake");
  });

  it("valor y procedencia viajan juntos, por CHECK", () => {
    // Un valor sin procedencia es medio dato; una procedencia sin valor es una afirmacion sobre nada.
    expect(MIGRACION).toContain('CHECK (("weight_goal_kg" IS NULL) = ("weight_goal_set_in" IS NULL))');
    expect(MIGRACION).toContain("IN ('entrada', 'tratamiento')");
  });
});

describe("vive donde la fila SIEMPRE existe (migración 0096)", () => {
  it("en `evaluations`, no en la fila opcional de las condiciones de la toma", () => {
    // EL DEFECTO QUE CIERRA, y lo encontro el primer smoke: la 0095 puso el peso meta en
    // `evaluation_bis_intake` porque la columna YA EXISTIA ahi. Eso no es una razon. Esa fila es OPCIONAL
    // (existe si alguien respondio las condiciones de la toma) y al medirlo, 41 de 60 tratamientos tenian
    // su evaluacion sin ella. El panel quedo bloqueado: "no se puede guardar el peso meta: esta evaluacion
    // no tiene registradas las condiciones de la toma". El error era correcto y describia un problema que
    // no tenia por que existir.
    expect(MUDANZA).toContain('ALTER TABLE "evaluations" ADD COLUMN "weight_goal_kg"');
    expect(MUDANZA).toContain('COMMENT ON COLUMN "evaluation_bis_intake"."weight_goal_kg"');
    expect(MUDANZA).toContain("SUPERSEDIDA");
    // Y los lectores/escritores apuntan ahi, no al intake.
    expect(READER).toContain('.from("evaluations")');
    expect(WRITER).toContain(".from(evaluations)");
    expect(quitarComentarios(WRITER)).not.toContain("evaluationBisIntake");
  });

  it("y por eso el writer ya no tiene guarda de \"y si no existe la fila\"", () => {
    // La guarda era correcta mientras el dato colgara de una fila opcional. Con el dato en su sitio, la
    // guarda sobra: si volviera a hacer falta, es que el peso meta volvio a colgar de algo opcional.
    expect(quitarComentarios(WRITER)).not.toContain("no tiene registradas las condiciones de la toma");
  });

  it("es POR EVALUACION y no por paciente, y la base lo explica", () => {
    // Cada consulta acuerda el suyo. En el perfil del paciente, cambiarlo en un seguimiento reescribiria
    // la prescripcion de una consulta pasada.
    expect(MUDANZA).toContain("POR EVALUACION y no por paciente");
  });
});

describe("una corrección no pierde los datos de la consulta", () => {
  it("copia motivo, sociodemográficos, peso meta y condiciones de la toma", () => {
    // HALLAZGO DEL SMOKE (2026-09-01): la evaluacion corregida nacia con motivo de consulta, escolaridad,
    // ocupacion, estado civil, estrato, etnia y ascendencia en NULL. Corregir un decimal de la encuesta
    // borraba la caracterizacion entera de la consulta, sin error y sin aviso: la pantalla nueva
    // simplemente los mostraba vacios. El observatorio estratifica por esos campos.
    for (const campo of [
      "reasonForVisit: ev.reasonForVisit",
      "educationLevel: ev.educationLevel",
      "occupation: ev.occupation",
      "maritalStatus: ev.maritalStatus",
      "socioeconomicStratum: ev.socioeconomicStratum",
      "ethnicity: ev.ethnicity",
      "ancestry: ev.ancestry",
      "weightGoalKg: ev.weightGoalKg",
    ]) {
      expect(CORRECCION, `la corrección dejó de copiar ${campo}`).toContain(campo);
    }
  });

  it("y la FUERZA PRENSIL, que desde el 31 alimenta el fenotipo", () => {
    // La mitad clinica del hallazgo: la medicion BIS se copia tal cual, pero las condiciones de esa toma
    // no viajaban. Desde el 2026-08-31 la fuerza prensil de esa fila es criterio PRIMARIO del fenotipo
    // (EWGSOP2), asi que perderla degradaba el diagnostico de sarcopenia de una correccion a la siguiente,
    // en silencio y con el numero puesto.
    expect(CORRECCION).toContain("gripStrengthKg: oldIntake.gripStrengthKg");
    expect(CORRECCION).toContain("tx.insert(evaluationBisIntake)");
  });

  it("se COPIAN del encuentro, no se releen del perfil", () => {
    // `patient_profiles` guarda el valor ACTUAL; estos son del ENCUENTRO. Tomarlos del perfil fabricaria
    // un historico falso, que es la razon por la que estas columnas existen versionadas por evaluacion.
    expect(CORRECCION).toContain("no se releen del perfil");
  });
});

describe("no se perdió quién lo fijó", () => {
  it("el panel distingue las tres procedencias", () => {
    expect(PANEL).toContain('const origenPeso: "tratamiento" | "entrada" | "calculado"');
    expect(PANEL).toContain("Peso meta fijado por ti aquí");
    expect(PANEL).toContain("Peso meta fijado en la entrada");
    expect(PANEL).toContain("Peso meta sin registrar");
  });

  it("y dice que es el MISMO campo, no otro", () => {
    // Es la frase que impide que el nutricionista lo lea como un segundo peso meta que puede discrepar.
    expect(PANEL).toContain("Es el mismo campo, no otro");
  });

  it("la procedencia solo cambia si cambia el VALOR, en las DOS superficies", () => {
    // Los dos formularios mandan su set completo de golpe, asi que se guardan tambien cuando nadie toco el
    // peso meta (el de la cadena para mover el PAL; el de la entrada para corregir una condicion).
    // Reescribir la procedencia ahi convertiria un guardado cualquiera en una afirmacion falsa sobre quien
    // decidio el peso del paciente.
    expect(WRITER).toContain("const cambio = anterior !== input.pesoMetaFijado");
    expect(WRITER).toContain("evalLocked?.origen");
    expect(INTAKE_WRITER).toContain("const pesoMetaCambio = pesoMetaAnterior !== input.weightGoalKg");
    expect(INTAKE_WRITER).toContain("previo?.origen");
  });
});

describe("el candado de concurrencia sigue cubriendo el peso meta, ahora en dos tablas", () => {
  it("sigue en la firma, aunque ya no viva en `treatments`", () => {
    // El formulario de la cadena lo ESCRIBE, asi que el candado tiene que cubrirlo o dos profesionales se
    // pisarian el peso meta sin que nadie lo note. Cambia el nombre del campo, no su posicion en la firma:
    // las firmas ya emitidas tienen que seguir coincidiendo.
    expect(FIRMA).toContain("pesoMetaFijado: number | null");
    expect(FIRMA).toContain('a.pesoMetaFijado ?? "",');
  });

  it("el writer lo lee bajo lock, y en un orden que no puede dar deadlock", () => {
    // Dos filas de dos tablas. El orden es siempre tratamiento y luego evaluacion; las otras escrituras de
    // `evaluations` no tocan `treatments`, asi que no hay ciclo posible.
    expect(WRITER).toContain(".from(evaluations)");
    expect(WRITER).toContain('.for("update", { of: [treatments] })');
    expect(WRITER).toContain("no hay ciclo posible entre ellas y no hay deadlock");
  });
});

describe("la superficie de la entrada dice a dónde va el número", () => {
  it("junto al campo, no en una ayuda aparte", () => {
    // Un campo que no dice que hace es como se quedo cuatro meses sin que nadie notara que no hacia nada.
    expect(CAPTURA).toContain("Es la base del cálculo");
    expect(CAPTURA).toContain("es el mismo dato, no otro");
  });
});

// CONTROL. Sin esto, todo lo de arriba pasaria verde tambien si el peso meta hubiera dejado de mover la
// prescripcion: se estaria cableando un dato inerte y el candado no lo notaria.
describe("CONTROL: el peso meta MUEVE la prescripción", () => {
  const SNAP: ProtocoloSnapshot = {
    pesoCalculo: 92,
    pesoCalculoLabel: "Peso actual",
    caloricoInputs: { ffm: 62, pesoN: 92, talla: 171, edad: 50, sexoM: true },
    estrategia: { label: "Mantenimiento", perfil: null, deficit: 0 },
    protMin: 1,
    restricciones: [],
  } as unknown as ProtocoloSnapshot;

  const sinAjustes: ProtocoloAjustes = {
    geb: null,
    pal: null,
    kcalObj: null,
    protGkg: null,
    fatPct: null,
    deficit: null,
    pesoMeta: null,
  };

  it("un peso meta distinto da gramos de proteína distintos", () => {
    const conCalculado = computeProtocoloEfectivo(SNAP, sinAjustes);
    const conMeta = computeProtocoloEfectivo(SNAP, { ...sinAjustes, pesoMeta: 78 });
    expect(conCalculado.pesoEfectivo).toBe(92);
    expect(conMeta.pesoEfectivo).toBe(78);
    expect(conMeta.calorico.protG).not.toBe(conCalculado.calorico.protG);
  });
});
