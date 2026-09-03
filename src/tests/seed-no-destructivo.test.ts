import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// EL SEED NO BORRA RESPUESTAS DE ENCUESTA. Nunca.
//
// EL DEFECTO QUE CIERRA, y no es hipotetico: `db:seed` hacia un "reemplazo autoritativo" que borraba
// `survey_answers` -> `survey_responses` -> `survey_questions` de la version vigente antes de resembrar.
// Su justificacion escrita era que "en dev no hay historia clinica real que preservar", y esa premisa era
// FALSA: la base local de Santiago tenia las respuestas de sus smokes y el seed se las llevo.
//
// **Un borrado que se apoya en una suposicion sobre el entorno es un borrado que un dia se lleva algo**, y
// esa es la forma que este candado persigue, no las tres lineas concretas.
//
// Y LO QUE LO HACIA BARATO DE ARREGLAR: los borrados eran REDUNDANTES. Las preguntas y las opciones ya se
// siembran con `upsert` por id, y los ids son deterministas (`surveyUuid` sobre version + clave), asi que
// el upsert solo deja exactamente las mismas filas. El borrado solo servia para quitar lo RETIRADO.
//
// POR QUE UN CANDADO DE TEXTO Y NO UNO QUE CORRA EL SEED: correr el seed en un test lo obligaria a operar
// sobre la misma base que los demas tests de BD, y un seed que se ejecuta en la suite es exactamente el
// riesgo que se acaba de cerrar. Lo que hay que garantizar es que el BORRADO no vuelva, y eso se lee.

const SEED = readFileSync("supabase/seed.ts", "utf8");

describe("la siembra de la encuesta es NO destructiva", () => {
  it("no borra respuestas ni respuestas-de-encuesta, por ninguna via", () => {
    // Las tres que existian. Si alguna vuelve, este caso cae.
    expect(SEED).not.toContain('from("survey_answers").delete()');
    expect(SEED).not.toContain('from("survey_responses").delete()');
    // Y el borrado en bloque de las preguntas de la version, que era lo que arrastraba a las otras dos.
    expect(SEED).not.toContain('from("survey_questions").delete().eq("survey_version_id"');
  });

  it("siembra con upsert por id, que es lo que hace innecesario el borrado", () => {
    // CONTROL: si esto dejara de ser un upsert, quitar los deletes habria dejado el seed sin efecto y el
    // caso de arriba seguiria verde. Los dos casos juntos son los que dicen algo.
    expect(SEED).toContain('from("survey_questions").upsert(surveyQuestionRows, { onConflict: "id" })');
    expect(SEED).toContain('from("survey_options").upsert(surveyOptionRows, { onConflict: "id" })');
  });

  it("barre los HUERFANOS, que era lo unico que el borrado resolvia", () => {
    // Sin esto, quitar una pregunta del set la dejaria viva en pantalla para siempre: el arreglo habria
    // cambiado un defecto por otro.
    expect(SEED).toContain("const huerfanas =");
    expect(SEED).toContain('from("survey_questions").delete().in("id", huerfanas.map((r) => r.id))');
    expect(SEED).toContain("const sobran =");
    expect(SEED).toContain('from("survey_options").delete().in("id", sobran)');
  });

  it("y FALLA EN VOZ ALTA si una pregunta retirada ya tiene respuestas", () => {
    // Es la parte que convierte el barrido en seguro. Que el contenido de la encuesta cambie bajo
    // respuestas existentes es lo que resuelve un BUMP DE VERSION, no un borrado silencioso.
    expect(SEED).toContain("El seed NO puede continuar");
    expect(SEED).toContain("sube SURVEY_VERSION_ID");
    // Y que sea un throw, no un console.warn: un aviso en un script de seed no lo lee nadie.
    expect(SEED).toMatch(/throw new Error\(\s*`El seed NO puede continuar/);
  });
});
