import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LA CUARTA SUBPESTAÑA · RESUMEN DEL DIAGNOSTICO.
//
// ESTE ARCHIVO SE REESCRIBIO EL 2026-09-08 y conviene decir por que, porque casi todas sus aserciones
// anteriores describian un bloque que ya no existe.
//
// Lo que habia: un campo donde el profesional escribia su CRITERIO, con un boton "Agregar criterio",
// append-only, y un boton para generar un borrador con IA que caia en ese mismo campo.
//
// Lo que lo rompio: al portar el paso 4 de su Analisis IA, ese campo empezo a recibir un resumen de
// cinco parrafos y salto su limite de 2.000 caracteres. El limite no era el defecto: era la SEÑAL de que
// un campo hacia DOS trabajos.
//
// Verificado en su archivo (v8 del 4 de septiembre): su "Resumen del Diagnostico" se pinta en un <div>,
// no en un textarea, y SE GUARDA. El profesional no lo edita. Y lo que el escribe son las
// OBSERVACIONES, que en Atlas ya existian: `treatment_notes`, por consulta, append-only, con la
// profesion sellada, y en la historia clinica desde su §8.3 del 2026-08-26.
//
// LO QUE SE CONSERVA DE ESTE ARCHIVO: que los criterios ya escritos no se pierdan, y el punto 14 (la
// entrada a corregir), que no dependia del campo.

const RESUMEN = readFileSync(
  "src/modules/diagnoses/components/resumen-diagnostico.tsx",
  "utf8",
);
const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");
// La entrada a corregir vive en su propio componente, no en la pantalla de entrada: el archivo viejo
// leia otro y por eso este candado apuntaba mal al reescribirlo.
const ENTRADA = readFileSync("src/modules/corrections/components/correction-entry.tsx", "utf8");
const FORM = readFileSync(
  "src/modules/corrections/components/correct-evaluation-form.tsx",
  "utf8",
);
const plano = (s: string) => s.replace(/\s+/g, " ");

describe("el resumen lo escribe el modelo y el profesional NO lo edita", () => {
  it("no hay campo de texto: es un bloque de lectura", () => {
    // La asercion central de la separacion. Si vuelve un textarea aqui, vuelve el defecto: un campo
    // recibiendo un documento.
    expect(RESUMEN, "volvio un campo editable al resumen").not.toMatch(
      /<(Textarea|textarea|input)\b/,
    );
    expect(RESUMEN).toContain("whitespace-pre-wrap");
  });

  it("y dice QUIEN lo escribe, donde se lee", () => {
    // Un texto clinico sin procedencia se lee como si lo hubiera escrito el profesional, y este no.
    expect(plano(RESUMEN)).toContain("Lo redacta el sistema");
    expect(plano(RESUMEN)).toContain("No es editable");
  });

  it("y manda a Seguimiento para lo que SI escribe el profesional", () => {
    // Sin esta linea, el profesional se queda sin saber donde escribir lo suyo, que es como se leyo el
    // error de longitud en el smoke.
    expect(plano(RESUMEN)).toContain("observaciones de la consulta van en Seguimiento");
  });

  it("se GUARDA, no se regenera al volver a la pantalla", () => {
    // Es lo que hace su archivo (`onUpdate({ analisisIA })`), y lo que evita pagarle al proveedor cada
    // vez que alguien abre la pestaña.
    expect(PAGE).toContain("resumen={results.aiSummary}");
    const writer = readFileSync("src/modules/diagnoses/data/ai-summary-writer.ts", "utf8");
    expect(writer).toContain("update(diagnoses)");
    expect(writer, "si no se escribio ninguna fila hay que fallar, no seguir").toContain(
      "el diagnóstico no existe",
    );
  });
});

describe("los criterios ya escritos no se pierden", () => {
  it("se muestran, en solo lectura y rotulados como lo que son", () => {
    // Hay 3 filas en produccion, escritas y ASUMIDAS por un profesional. Migrarlas seria reescribir el
    // acto de otro; borrarlas, peor. La leccion del almacen que se elige por la propiedad que resuelve
    // lo de delante y se olvida la de LECTURA.
    expect(RESUMEN).toContain("Criterios que registraste antes");
    expect(PAGE).toContain("criteriosPrevios");
  });

  it("y ya no se pueden escribir mas: la action se retiro", () => {
    // Una server action es un endpoint POST: dejarla viva sin boton no la vuelve inofensiva, la vuelve
    // una via de escritura que nadie ve. Lo encontro `pnpm check:cables`.
    const actions = readFileSync("src/modules/diagnoses/actions.ts", "utf8");
    // Se afirma sobre la DECLARACION, no sobre el nombre: la nota que explica por que se fue lo menciona,
    // y una asercion sobre el nombre suelto se pondria roja por su propia explicacion.
    expect(actions, "volvio el writer del criterio").not.toContain(
      "export async function addDiagnosisNoteAction",
    );
    expect(actions, "y con su razon escrita").toContain("AQUI VIVIA");
  });
});

describe("la entrada a corregir: se queda, pero sin repetir el alcance (cotejo punto 14)", () => {
  it("sigue existiendo el camino desde el cierre del diagnóstico", () => {
    expect(ENTRADA).toContain("¿Un dato de la encuesta quedó mal?");
    expect(ENTRADA).toContain("/corregir");
  });

  it("y la explicación del alcance vive en la pantalla a la que lleva, no repetida aquí", () => {
    expect(plano(FORM), "el alcance completo vive en el formulario").toContain(
      "La medición del equipo sí se puede volver a importar",
    );
    expect(plano(ENTRADA), "y NO repetido en la entrada").not.toContain(
      "La medición del equipo sí se puede volver a importar",
    );
  });
});
