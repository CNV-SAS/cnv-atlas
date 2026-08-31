import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LAS NOTAS POR PROFESION (Gildardo 2026-08-30 §8).
//
// SU INSTRUCCION: "Una por profesion, tres campos distintos. Cada rol escribe lo suyo y no se pisan: el
// nutricionista no edita la nota del medico."
//
// LO QUE SE FIJA, Y ES UNA SOLA COSA: que la profesion se SELLE en el acto y salga del PERFIL del actor,
// nunca del formulario. Si viajara en el FormData, un profesional podria firmar una nota con el rol de
// otro, que es exactamente lo que su instruccion excluye, y ninguna validacion de contenido lo atraparia.
//
// Y UNA CORRECCION NUESTRA QUE QUEDA ESCRITA AQUI, para que nadie la repita: la pregunta que le hicimos
// (ronda del 29, punto 8) decia que "en el panel por profesion hay TRES campos de nota" en su archivo.
// Fuimos a verificarlo al aplicar su respuesta y NO ES ASI: su archivo tiene `trat.porProfesional`, un
// sub-almacen por profesion con CUATRO roles (nutricionista, medico, entrenador, psicologo, su propio
// PROF_LABELS), y sus campos de texto libre son `diagProf` y `tratSugerido`, no unas "notas". El respondio
// sobre NUESTRA premisa. El PRINCIPIO que dio vale igual y es el que se aplica; el conteo y la identidad de
// los campos van declarados en la ronda del 31.

const SERVICE = readFileSync("src/modules/treatment/services/treatment-service.ts", "utf8");
const WRITER = readFileSync("src/modules/treatment/data/treatment-writer.ts", "utf8");
const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const SCHEMA = readFileSync("src/db/schema/treatments.ts", "utf8");
const VALIDACIONES = readFileSync("src/modules/treatment/validations.ts", "utf8");

/** El cuerpo de una funcion exportada, para no cazar coincidencias de otra. */
function cuerpo(src: string, nombre: string): string {
  const i = src.indexOf(`export async function ${nombre}(`);
  if (i < 0) throw new Error(`no encuentro ${nombre}`);
  const j = src.indexOf("\nexport ", i + 1);
  return src.slice(i, j < 0 ? undefined : j);
}

describe("la profesión se sella en el acto, y sale del perfil", () => {
  it("`addNote` lee la profesión del ACTOR, no del formulario", () => {
    const b = cuerpo(SERVICE, "addNote");
    expect(b, "la profesión dejó de leerse del perfil del actor").toContain("getActorProfession(actor.actorId)");
    expect(b).toContain("profession:");
  });

  it("y el schema de la nota NO acepta una profesión desde fuera", () => {
    // La mitad que de verdad protege: si `addNoteSchema` aceptara `profession`, un profesional podría
    // firmar la nota de otro rol invocando la action directo, sin pasar por la pantalla.
    const i = VALIDACIONES.indexOf("export const addNoteSchema");
    const j = VALIDACIONES.indexOf("export ", i + 1);
    expect(
      VALIDACIONES.slice(i, j),
      "el schema de la nota acepta una profesión del formulario: un rol podría firmar por otro",
    ).not.toContain("profession");
  });

  it("el writer la persiste y la deja en la auditoría", () => {
    const b = cuerpo(WRITER, "addTreatmentNote");
    expect(b).toContain("profession: input.profession");
    expect(b, "el audit log no registra con qué rol se escribió").toContain("profession: input.profession");
  });

  it("la columna es NULLABLE, y eso es una afirmación sobre las notas viejas", () => {
    // Las anteriores a la separación se escribieron cuando el campo era uno solo y compartido. Ponerles
    // una profesión ahora sería FABRICAR autoría clínica. El null dice la verdad.
    expect(SCHEMA).toContain('profession: professionalProfession("profession")');
    expect(SCHEMA, "la profesión de la nota se volvió obligatoria: eso rompe las notas anteriores").not.toContain(
      'professionalProfession("profession").notNull()',
    );
  });
});

describe("la pantalla agrupa, no oculta", () => {
  it("las notas se muestran agrupadas por profesión", () => {
    expect(PANEL).toContain("agruparNotasPorProfesion");
    expect(PANEL).toContain("PROFESION_NOTA");
  });

  it("y las de otro rol SIGUEN VISIBLES: lo que él excluye es compartir el campo, no la información", () => {
    // Un filtro por "solo las mías" sería una lectura de más de su instrucción, y le quitaría al médico
    // lo que anotó la nutricionista sobre el mismo paciente.
    expect(PANEL, "la pantalla filtra las notas de otras profesiones").not.toMatch(
      /notes\.filter\([^)]*profession\s*===/,
    );
  });

  it("las notas sin profesión se rotulan, no se reparten", () => {
    expect(PANEL).toContain("Sin profesión registrada");
  });
});
