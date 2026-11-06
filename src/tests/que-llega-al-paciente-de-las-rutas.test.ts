import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { RUTAS_CONTENT } from "@/clinical-engine/rutas-content";

vi.mock("server-only", () => ({}));

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: QUE DE LAS RUTAS LLEGA AL PACIENTE, RUTA POR RUTA  ·  SU HOJA 3 (Santiago, 2026-11-03)
//
// ═══ POR QUE ESTE CANDADO IMPRIME LA LISTA EN VEZ DE COMPROBAR UNA REGLA ═══
//
// El filtro trabaja por CATEGORIAS (dosis, alimentos, ejercicio tecnico, mecanismos, instrucciones al
// profesional), no linea por linea. Eso es lo que evita cien banderas escritas a mano, y tiene un precio:
// una categoria mal escrita puede dejar fuera algo que si era del paciente, o colar algo que no.
//
// ASI QUE LAS DECISIONES QUEDAN A LA VISTA: este caso FIJA lo que sobrevive en cada una de las seis rutas.
// Cambiar el filtro mueve estas listas y hay que mirarlas; no se puede ajustar un patron "a ver si pasa".
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const { indicacionesParaElPaciente } = await import("@/modules/reports/data/informe-paciente-reader");

/**
 * Lo que de una ruta llega al paciente. SE LLAMA A LA FUNCION DEL LECTOR, no se replica su seleccion: la
 * primera version de este candado recorria los CUATRO componentes y el lector solo manda tres (el medico
 * viaja como remision, no como texto), asi que el test medía un documento que no existe y acusaba al
 * filtro de colar lineas que nunca salian.
 */
function loQueLlega(id: string): string[] {
  return indicacionesParaElPaciente(RUTAS_CONTENT[id]);
}

describe("de las rutas al paciente llega lo que puede hacer, no la receta del profesional", () => {
  it("ninguna ruta le manda dosis, alimentos, receta de ejercicio ni mecanismos", () => {
    const culpables: string[] = [];
    for (const id of Object.keys(RUTAS_CONTENT)) {
      for (const linea of loQueLlega(id)) {
        if (/g\s*\/\s*kg|kcal|≥|1RM|Nrf2|metilaci|cúrcuma|sulforafano|leucina/i.test(linea)) {
          culpables.push(`${id}: ${linea}`);
        }
      }
    }
    expect(culpables, "estas líneas llegan al paciente y son del profesional").toEqual([]);
  });

  it("y la única ruta que se queda sin nada que decirle es R4, que es un pendiente de Gildardo", () => {
    // LA OTRA MITAD, Y AQUI HAY UN HALLAZGO. Un filtro que lo quita todo pasaría el caso de arriba y
    // dejaría al paciente con el título de un área y nada debajo, que es peor que el texto técnico.
    //
    // R4 (desaceleración del envejecimiento) se queda vacía, y NO es un hueco del filtro: sus tres
    // componentes son exactamente lo que Santiago saca del documento (proteína en g/kg, alimentos
    // antioxidantes, prescripción de resistencia progresiva). No existe una versión de esas indicaciones
    // escrita para el paciente, y escribirla sería autoría clínica nuestra. Está en el documento de dudas.
    //
    // SE FIJA LA LISTA EXACTA, no "alguna puede estar vacía": si mañana otra ruta se queda muda, hay que
    // enterarse, porque puede ser el filtro y no su contenido.
    const vacias = Object.keys(RUTAS_CONTENT).filter((id) => loQueLlega(id).length === 0);
    expect(vacias, "una ruta nueva se quedó muda: mira si es el filtro o su contenido").toEqual(["R4"]);
  });

  it("y el informe del paciente ya no nombra ninguna de esas áreas", () => {
    // ═══ ESTE CASO SE DIO VUELTA EL 2026-11-05, Y CONVIENE LEER POR QUE ═══
    //
    // Afirmaba que el informe, al nombrar un área sin ninguna línea en lenguaje de paciente (R4), DIJERA
    // dónde está el detalle, en vez de dejar el título solo. Era la mitad que cerraba el hallazgo de
    // arriba.
    //
    // SANTIAGO SACO LAS RUTAS DEL INFORME: *"SALEN las rutas, los suplementos y las remisiones: la razón es
    // que el informe no puede recomendar algo que la profesional no recomendó."* Así que el documento ya no
    // nombra ningún área, y un título solo dejó de ser posible.
    //
    // LO QUE SE VIGILA AHORA ES LO CONTRARIO, y es más fuerte: que NINGUNA indicación de ruta vuelva al
    // informe. El hallazgo de R4 sigue vivo donde importa (el filtro y su pendiente con Gildardo, que
    // miden los dos casos de arriba); lo que cambió es que el documento del paciente dejó de ser el sitio
    // donde ese hueco podía verse.
    const PDF = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
    expect(PDF, "volvió el bloque de rutas al informe del paciente").not.toContain(
      "informe.rutas.map(",
    );
    expect(PDF, "el informe volvió a leer las indicaciones de una ruta").not.toContain(
      "r.indicaciones",
    );
  });

  it("y se ve exactamente qué sobrevive en cada ruta", () => {
    // La fotografía. Si el filtro cambia, estas listas cambian y hay que leerlas una por una.
    const foto = Object.fromEntries(Object.keys(RUTAS_CONTENT).map((id) => [id, loQueLlega(id)]));
    expect(foto).toMatchSnapshot();
  });
});
