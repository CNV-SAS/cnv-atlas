import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LA FRANJA DE VEREDICTO SE RETIRO  ·  pedido de GILDARDO, via Santiago, 2026-11-05
//
// *"Fuera, por pedido de Gildardo, el bloque que sale en las cuatro subpestañas: 'Estado EFR: X de 81 ·
// ... · Riesgo integrado · Ruta prioritaria (ver en Tratamiento)'."*
//
// ═══ ESTE ARCHIVO SE DIO VUELTA, NO SE BORRO ═══
//
// Medía que la franja mostrara sus tres datos y que con el DFI incompleto dijera "Provisional". Borrarlo
// con el componente habría dejado la decisión sin rastro ejecutable, y esta franja ya tiene historia: se
// puso con un argumento razonable (que la conclusión no la escondiera ninguna subpestaña), así que es
// exactamente la clase de pieza que alguien repone de buena fe al leer ese argumento en un documento
// viejo. Ahora el archivo vigila las DOS mitades de la decisión:
//
//   1 · que la franja no vuelva, y
//   2 · que sus tres datos sigan donde de verdad viven, que es lo que hizo seguro retirarla.
//
// LA SEGUNDA MITAD ES LA QUE IMPORTA. Una franja que fuera el ÚNICO sitio de una cifra no se puede quitar
// sin más: se comprobó uno por uno antes de borrarla, y se comprueba aquí para que siga siendo cierto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const RESULTADOS = "src/modules/diagnoses/components/evaluation-results.tsx";
const MAPAS = "src/modules/diagnoses/components/maps-section.tsx";

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

describe("la franja de veredicto del diagnostico, retirada por Gildardo", () => {
  it("el componente ya no existe, y nadie lo monta", () => {
    expect(
      existsSync("src/modules/diagnoses/components/verdict-strip.tsx"),
      "volvio el componente de la franja de veredicto",
    ).toBe(false);
    // Y no queda el import huérfano ni un montaje: el componente se borra en vez de quedarse sin
    // llamadores, que es la regla de esta casa (una pieza muerta es el cable que alguien reconecta).
    expect(leer(RESULTADOS), "la franja volvio a montarse en el diagnostico").not.toContain(
      "VerdictStrip",
    );
  });

  it("y la pantalla no reconstruye su linea a mano, que es la otra forma de que vuelva", () => {
    // Si alguien la repone sin el componente, lo haría escribiendo los rótulos sueltos encima de las
    // subpestañas. Lo que se prohíbe es el ROTULO del estado EFR en este archivo, que es el único de los
    // tres que la franja traía y que aquí no tiene otro sitio legítimo.
    expect(
      leer(RESULTADOS),
      "alguien reescribio la linea del estado EFR encima de las subpestañas",
    ).not.toContain("Estado EFR");
  });

  it("CONTROL · el riesgo integrado sigue en Funcional, y con mas de lo que traia la franja", () => {
    // Era uno de los tres datos de la franja. Vive en la subpestaña Funcional, con su insignia de nivel y
    // score, el rótulo de la escala, el veto si aplica y la descripción del nivel. Si esto desapareciera,
    // retirar la franja SÍ habría perdido una cifra.
    const src = leer(RESULTADOS);
    expect(src, "se perdio el riesgo integrado al retirar la franja").toContain("Riesgo integrado:");
    expect(src, "el riesgo integrado se quedo sin su nivel y su score").toContain("dfi.riesgo.nivel");
    expect(src, "el riesgo integrado se quedo sin su descripcion").toContain("dfi.riesgo.descripcion");
    // Y con el DFI incompleto sigue diciendo "Provisional" en vez del nivel inflado (Q28). Esa garantía
    // era del caso que este archivo medía sobre la franja, y se mantiene donde ahora vive el dato.
    expect(src, "con la encuesta a medias volvio a salir el nivel concreto").toContain("Provisional");
  });

  it("CONTROL · el estado EFR con su «de 81» sigue en la subpestaña Mapas", () => {
    expect(leer(MAPAS), "se perdio el estado EFR al retirar la franja").toContain("Estado EFR");
    expect(leer(MAPAS), "el estado EFR se quedo sin su denominador").toContain("de 81");
  });

  it("CONTROL · la ruta prioritaria no era contenido, era un puntero, y las rutas siguen en Tratamiento", () => {
    // La franja decía el nombre de la primera ruta y "(ver en Tratamiento)". No se pierde nada porque el
    // contenido nunca estuvo ahí: las rutas viven enteras en Tratamiento.
    const tratamiento = leer("src/modules/treatment/components/profession-treatment-section.tsx");
    expect(tratamiento, "las rutas dejaron de salir en Tratamiento").toMatch(/ruta/i);
  });
});
