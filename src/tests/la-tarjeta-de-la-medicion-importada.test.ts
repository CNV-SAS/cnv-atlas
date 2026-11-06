import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA TARJETA DE "MEDICION BIS IMPORTADA", IGUAL EN LAS DOS PESTAÑAS  ·  2026-11-06
//
// El mismo hecho se anuncia en Antropometria y en BIS, y hasta el 2026-11-06 se anunciaba de dos formas
// distintas (una pastilla gris sin fecha y un bloque gris con la fecha). El mismo hecho dicho de dos
// maneras en dos pestañas de la misma consulta se lee como dos cosas distintas.
//
// Y EL COLOR DE ESTA TARJETA YA CAMBIO TRES VECES, que es la razon de que exista este candado:
//   · hasta el 2026-09-05 llevaba `clinical-optimal`, el verde del VEREDICTO sobre el paciente;
//   · ese dia se dejo NEUTRA, con razon, para no afirmar de alguien algo que nadie midio;
//   · el 2026-11-06 Santiago la pidio verde otra vez, y en una segunda vuelta con fondo y letra.
//
// Lo que este candado protege no es el gusto: es que el verde sea el de la capa de INTERFAZ (`--exito`) y
// NO el de la escala clinica. Esa frontera es la que CLAUDE.md llama la capa clinica, y es la unica parte
// de esta tarjeta que no se decide por preferencia.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const SUPERFICIES = [
  ["BIS", "src/modules/bis/components/bis-import-form.tsx"],
  ["Antropometria", "src/modules/evaluations/components/entrada-evaluacion.tsx"],
] as const;

describe("la tarjeta de la medicion importada", () => {
  for (const [pestana, ruta] of SUPERFICIES) {
    it(`en ${pestana}: fondo verde claro, letra verde oscuro, y el verde es el de interfaz`, () => {
      const codigo = readFileSync(ruta, "utf8");
      // LA MISMA FORMA EN LAS DOS, que es a lo que vino este bloque.
      expect(codigo, "la tarjeta dejo de llevar el borde y el fondo de exito").toContain(
        "border border-exito/40 bg-exito-bg",
      );
      expect(codigo, "la letra de la tarjeta dejo de ser verde oscuro").toContain(
        'className="text-sm font-medium text-exito"',
      );
      expect(codigo).toContain("Medición BIS importada");
      // Y LA FECHA DE LA TOMA, que es lo que hacia util al aviso: sin ella solo dice que algo entro.
      expect(codigo, "la tarjeta dejo de decir cuando se tomo la medicion").toContain("tomada el ");
    });

    it(`en ${pestana}: NO vuelve el verde clinico, que es un veredicto sobre el paciente`, () => {
      const codigo = readFileSync(ruta, "utf8");
      // La decision del 2026-09-05 sigue en pie: `--clinical-optimal` (#10b981) significa OPTIMO SOBRE UNA
      // PERSONA. Gastarlo en "el archivo se importo" dice de un paciente algo que nadie midio. Se mira la
      // forma de la clase y no la prosa, porque los comentarios de los dos archivos lo nombran para
      // contar por que no se usa.
      expect(codigo, "volvio el verde clinico a un aviso de proceso").not.toMatch(
        /className="[^"]*clinical-optimal/,
      );
    });
  }

  it("y el token de exito tiene su par declarado en las dos apariencias", () => {
    const CSS = readFileSync("src/app/globals.css", "utf8");
    // El color de letra y el fondo, en claro.
    expect(CSS).toContain("--exito: #15803d;");
    expect(CSS).toContain("--exito-bg: #f0fdf4;");
    // Y LOS DOS EN OSCURO: un token que solo existe en claro deja la tarjeta con letra de un tema sobre
    // el fondo del otro, que es el defecto clasico de este archivo.
    expect(CSS).toContain("--exito: #4ade80;");
    expect(CSS.match(/--exito-bg:/g) ?? [], "falta `--exito-bg` en uno de los dos temas").toHaveLength(2);
    // Expuesto a Tailwind, o las clases `bg-exito-bg`/`text-exito` no existen y fallan EN SILENCIO (el
    // valor arbitrario que no parsea no da error, memoria del proyecto).
    expect(CSS).toContain("--color-exito: var(--exito);");
    expect(CSS).toContain("--color-exito-bg: var(--exito-bg);");
  });
});
