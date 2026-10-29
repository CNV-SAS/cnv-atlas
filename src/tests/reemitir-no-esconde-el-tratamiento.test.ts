import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: REEMITIR UN DIAGNOSTICO NO PUEDE CAMBIAR LO QUE MUESTRA NINGUNA PANTALLA DEL TRATAMIENTO
//
// ═══ EL DEFECTO QUE LO MOTIVA (Santiago, 2026-10-29) ═══
//
// Corrida la primera tanda de recalibracion, las cuatro evaluaciones reemitidas empezaron a decir *"El
// protocolo aparece cuando el diagnostico esta generado"* con el tratamiento INTACTO en la base. El
// diagnostico estaba generado y la prescripcion existia: la pantalla afirmaba lo contrario.
//
// ═══ LA CAUSA, QUE ES UNA FORMA DE CONSULTA, NO UN LUGAR ═══
//
// Dos pasos: (1) resolver el diagnostico VIGENTE de la evaluacion (la ultima fila), (2) buscar el
// tratamiento de ESE diagnostico. El paso (2) es el que falla, porque `treatments.diagnosis_id` apunta al
// diagnostico sobre el que se construyo y ahi se QUEDA a proposito (la reemision no toca la prescripcion
// del profesional). Asi que tras una reemision el paso (2) no encuentra nada.
//
// Aparecia en CINCO sitios, y ninguno fallaba igual:
//   · `getTreatmentProtocol`     el panel de Nutricionista decia que no hay protocolo (el sintoma visible)
//   · `getTreatmentForApproval`  aprobar la prescripcion habria dicho que no hay nada que aprobar
//   · `getCorrectionWarnings`    el PEOR: callaba "vas a perder N ajustes, las notas, la proxima cita"
//                                justo antes de una correccion que los rehace. Un aviso que calla se lee
//                                como "no hay nada que perder", que es lo contrario de la verdad.
//   · `saveProximoControl`       agendar la cita LANZABA; y su `limit(1)` sin `orderBy` ya era indefinido
//   · `getDiagnosisCriterion`    las notas de criterio del profesional desaparecian de la pantalla
//
// Los otros ocho lectores (informe, HC, plan, proximo control, tablero, referidos, pagos, freno de
// trayectoria) nunca se rompieron, y la razon es que ya subian del tratamiento a su diagnostico filtrando
// por la EVALUACION. O sea: el camino correcto ya existia en la casa y estos cinco no lo usaban.
//
// POR ESO ESTE CANDADO NO ENUMERA LOS CINCO, BARRE LA FORMA. Enumerarlos dejaria pasar el sexto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

function archivosDe(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => `${dir}/${f.split("\\").join("/")}`);
}

const FUENTES = [...archivosDe("src/modules"), ...archivosDe("src/app")].map((ruta) => ({
  ruta,
  codigo: sinComentarios(readFileSync(ruta, "utf8")),
}));

/** Los archivos que LEEN o ESCRIBEN la tabla de tratamientos. */
const TOCAN_TRATAMIENTOS = FUENTES.filter(
  (f) => f.codigo.includes('from("treatments")') || f.codigo.includes("from(treatments)"),
);

describe("ningun lector del tratamiento depende del diagnostico VIGENTE", () => {
  it("hay lectores que barrer (si esto baja a cero, el candado se quedo sin objeto)", () => {
    // Una red que no pesca nada pasa siempre. Si alguien renombra la tabla o mueve los lectores, el
    // candado seguiria verde sin vigilar nada: esta cuenta es lo que lo impide.
    expect(TOCAN_TRATAMIENTOS.length).toBeGreaterThanOrEqual(10);
  });

  it("ninguno filtra treatments por un diagnosis_id resuelto aparte", () => {
    // LA FORMA PROHIBIDA, en los dos dialectos de la casa:
    //   supabase-js:  .eq("diagnosis_id", diag.id)
    //   drizzle:      where(eq(treatments.diagnosisId, diag.id))
    // Lo permitido es el JOIN, que es lo contrario: eq(diagnoses.id, treatments.diagnosisId).
    for (const { ruta, codigo } of TOCAN_TRATAMIENTOS) {
      expect(codigo, `${ruta} filtra el tratamiento por un diagnosis_id suelto`).not.toMatch(
        /\.eq\(\s*"diagnosis_id"/,
      );
      // `eq(treatments.diagnosisId, X)` solo vale si X es una COLUMNA de diagnoses (el join). Cualquier
      // otra cosa (diag.id, anterior.id, vigente.id) es la forma que esconde el tratamiento.
      const comparaciones = codigo.match(/eq\(\s*treatments\.diagnosisId\s*,\s*([^)]+)\)/g) ?? [];
      for (const c of comparaciones) {
        expect(c, `${ruta}: ${c} no es un join contra diagnoses`).toMatch(/diagnoses\.id/);
      }
    }
  });

  it("y los cinco que estaban mal llegan al tratamiento POR LA EVALUACION", () => {
    // El control positivo del barrido de arriba: que el camino nuevo sea el correcto, no solo que el
    // viejo no este. Cada uno con el dialecto que usa.
    const esperado: [string, RegExp][] = [
      ["src/modules/treatment/data/treatment-reader.ts", /\.eq\("diagnoses\.evaluation_id", evaluationId\)/],
      ["src/modules/corrections/data/correction-warnings-reader.ts", /eq\(dxDelTratamiento\.evaluationId, evaluationId\)/],
      ["src/modules/followups/data/proximo-control-writer.ts", /eq\(diagnoses\.evaluationId, input\.evaluationId\)/],
      ["src/modules/diagnoses/data/diagnosis-notes-reader.ts", /\.eq\("diagnoses\.evaluation_id", evaluationId\)/],
    ];
    for (const [ruta, patron] of esperado) {
      const f = FUENTES.find((x) => x.ruta === ruta);
      expect(f, `no se encontro ${ruta}`).toBeDefined();
      expect(f!.codigo, `${ruta} dejo de buscar por la evaluacion`).toMatch(patron);
    }
    // El lector del tratamiento tiene DOS consultas (el protocolo y la aprobacion) y las dos tienen que
    // ir por la evaluacion: arreglar una sola fue el error original.
    const tr = FUENTES.find((x) => x.ruta === "src/modules/treatment/data/treatment-reader.ts")!;
    expect(tr.codigo.match(/\.eq\("diagnoses\.evaluation_id", evaluationId\)/g) ?? []).toHaveLength(2);
  });

  it("las notas de criterio se LEEN por la evaluacion pero se ESCRIBEN en el vigente", () => {
    // Las dos mitades son distintas a proposito. Si alguien "simplifica" devolviendo el diagnostico de la
    // nota mas reciente, una nota nueva se colgaria de un diagnostico que ya no es el vigente.
    const notas = FUENTES.find(
      (x) => x.ruta === "src/modules/diagnoses/data/diagnosis-notes-reader.ts",
    )!;
    expect(notas.codigo).toMatch(/diagnosisId: diag\.id/);
    expect(notas.codigo).toMatch(/\.order\("created_at", \{ ascending: false \}\)/);
  });
});

describe("la reemision hereda el freno de trayectoria del otro constructor", () => {
  const REEMISION = sinComentarios(
    readFileSync("src/modules/clinical-pipeline/services/reemitir-diagnostico.ts", "utf8"),
  );

  it("copia la banda sellada al informe nuevo", () => {
    // `emitirVersionNueva` ya lo tenia, con su razon escrita: la banda se copia porque el freno del cambio
    // desfavorable tiene que seguir aplicando sobre la version nueva, y si no se copiara, emitir una
    // version nueva seria la forma de saltarselo.
    //
    // La reemision nacio SIN copiarla: un segundo constructor del mismo insumo que no heredo lo ya
    // resuelto en el primero. Con la banda en nulo, el informe nuevo (la ultima fila, o sea el vigente)
    // se habria podido enviar sin el paso que obliga a hacerse cargo del cambio desfavorable.
    for (const campo of [
      "trajectory: (informeAnterior?.trajectory ?? null)",
      "trajectoryCommunicatedAt: informeAnterior?.trajectoryCommunicatedAt",
      "trajectoryCommunicatedBy: informeAnterior?.trajectoryCommunicatedBy",
    ]) {
      expect(REEMISION, `la reemision dejo de copiar ${campo}`).toContain(campo);
    }
  });

  it("y los DOS constructores de una fila de reports siguen copiandola", () => {
    // El candado se pone sobre los dos, no sobre el que falló: son los dos sitios que insertan una fila de
    // `reports` para una consulta que ya tenia una, y el tercero que aparezca tiene que pasar por aqui.
    const otro = sinComentarios(readFileSync("src/modules/reports/data/reports-writer.ts", "utf8"));
    expect(otro, "emitirVersionNueva dejo de copiar la trayectoria").toContain("trajectory: anterior.trajectory");
  });
});
