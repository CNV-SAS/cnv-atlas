import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADOS DE LOS PUNTOS 11, 13 Y 14 DEL COTEJO (2026-09-05), que son tres cosas del mismo tramo final
// de Diagnóstico Funcional.
//
// 11 · El bloque del criterio se llamaba solo "Criterio del profesional" y su archivo titula la sección
//      "Diagnóstico Integrado ANI-BIS-E". Van los DOS: el suyo de antetítulo (es el nombre de la sección
//      en su modelo) y el nuestro de título (aquí escribe el profesional, y en SU archivo ese panel es de
//      solo lectura con el texto de la IA, sin campo para escribir). Poner solo el suyo diría que lo
//      redactó la máquina.
// 13 · Que el criterio sea append-only estaba dicho a media pantalla del botón, y Santiago preguntó justo
//      eso ("¿qué pasa si se equivocó?"). Un acto irreversible dice lo que hace DONDE se pulsa.
// 14 · La entrada a corregir se queda (son dos momentos, no una repetición), pero sin los dos párrafos de
//      alcance que ya están verbatim en la pantalla a la que lleva.

const CRITERIO = sinComentarios(
  readFileSync("src/modules/diagnoses/components/professional-criterion.tsx", "utf8"),
);
const ENTRADA = sinComentarios(
  readFileSync("src/modules/corrections/components/correction-entry.tsx", "utf8"),
);
const FORM = sinComentarios(
  readFileSync("src/modules/corrections/components/correct-evaluation-form.tsx", "utf8"),
);

const plano = (t: string) => t.replace(/\s+/g, " ");

describe("bloque del criterio del profesional (cotejo punto 11)", () => {
  it("lleva el nombre de la sección de SU archivo como antetítulo", () => {
    expect(CRITERIO).toContain("Diagnóstico Integrado ANI-BIS-E");
  });

  it("y conserva el título propio: aquí escribe el profesional, no la máquina", () => {
    // Control del par: si un día alguien reemplaza el nuestro por el suyo, la pantalla diría que el
    // texto lo redactó el sistema, que es lo contrario de para lo que existe el bloque.
    expect(CRITERIO).toContain("Criterio del profesional");
  });

  it("ya no se dibuja con borde discontinuo, que en la app significa 'aquí no hay nada todavía'", () => {
    // Lo que Santiago llamó "muy simple y extraño". La distinción respecto de la evidencia del motor se
    // dice con palabras (el antetítulo y la insignia), no con un borde que significa otra cosa.
    const seccion = CRITERIO.slice(CRITERIO.indexOf("<section"), CRITERIO.indexOf(">", CRITERIO.indexOf("<section")));
    expect(seccion).not.toContain("border-dashed");
    expect(CRITERIO).toContain("Lo escribes tú");
  });
});

describe("el criterio es append-only y lo dice donde se pulsa (cotejo punto 13)", () => {
  it("la advertencia vive junto al botón de agregar, no solo en el párrafo de arriba", () => {
    const i = CRITERIO.indexOf('type="submit"');
    expect(i, "el botón de agregar").toBeGreaterThan(-1);
    // La ventana es el bloque del botón: si la frase estuviera solo arriba, aquí no aparecería.
    const cerca = plano(CRITERIO.slice(i - 400, i + 600));
    expect(cerca).toContain("no se puede borrar");
    // CAMBIO LA FRASE, NO LA GARANTIA (2026-09-06, punto 13a). Decia "el último es el vigente", que era
    // una DEDUCCION que el profesional tenia que hacer sobre una lista numerada. Ahora la pantalla lo
    // rotula ("Criterio vigente") y el aviso dice lo que pasa al agregar otro.
    expect(cerca).toContain("pasa a ser el vigente");
  });
});

describe("manda el ÚLTIMO criterio, y los anteriores no se pierden (cotejo punto 13a)", () => {
  it("el vigente se rotula como tal: no hay que deducirlo de una lista", () => {
    expect(CRITERIO).toContain("Criterio vigente");
  });

  it("y los anteriores quedan PLEGADOS, no borrados", () => {
    // Misma razón que el punto 26: son append-only porque son registro clínico, y quien escribió uno
    // tiene que poder releerlo. Lo que se decide aquí es cuál MANDA, no cuál existe.
    expect(CRITERIO).toContain("<details");
    expect(CRITERIO).toContain("criterios anteriores");
    expect(CRITERIO).toContain("notes.slice(0, -1)");
    expect(CRITERIO).toContain("notes[notes.length - 1]");
  });
});

describe("la entrada a corregir: se queda, pero sin repetir el alcance (cotejo punto 14)", () => {
  it("sigue existiendo el camino desde el cierre del diagnóstico", () => {
    expect(ENTRADA).toContain("¿Un dato de la encuesta quedó mal?");
    expect(ENTRADA).toContain("/corregir");
  });

  it("y la explicación del alcance vive en la pantalla a la que lleva, no repetida aquí", () => {
    // El texto largo (qué se corrige y qué no, con el detalle de la medición) es del formulario de
    // corrección. Aquí queda una línea. Si el largo vuelve a las dos partes, esto se pone rojo.
    expect(plano(FORM), "el alcance completo vive en el formulario").toContain(
      "La medición del equipo sí se puede volver a importar",
    );
    expect(plano(ENTRADA), "y NO repetido en la entrada").not.toContain(
      "La medición del equipo sí se puede volver a importar",
    );
  });
});
