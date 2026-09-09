import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL ORDEN Y LA PAGINACION DE LA LISTA DE PACIENTES (2026-09-09).
//
// EL DEFECTO QUE CIERRA, y lo encontro Santiago mirando la pantalla: la lista ORDENABA POR ALGO QUE NO SE
// VE. El reader ordenaba por "apellido nombre" y la fila pinta "nombre apellido", asi que a ojo la lista
// parecia desordenada y no habia forma de saber por que. Es un defecto de los que no dan error nunca:
// las dos mitades son correctas por separado.
//
// Y LA SEGUNDA MITAD ES QUE SON DOS CAPAS: el reader trae un orden y la vista tiene el suyo (conmutador
// A-Z / evaluacion reciente). Si divergen, la lista SALTA al hidratar, que es peor que estar mal ordenada
// desde el principio porque parece que la pantalla se movio sola.
const VISTA = sinComentarios(
  readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8"),
);
const READER = sinComentarios(
  readFileSync("src/modules/patients/data/patients-list-reader.ts", "utf8"),
);

describe("se ordena por lo que se ve", () => {
  it("la fila pinta `nombre apellido`", () => {
    // El ancla de todo lo demas: si algun dia la fila pasa a "Apellido, Nombre", los dos ordenes de abajo
    // dejan de ser los correctos y este caso obliga a mirarlo.
    expect(VISTA).toContain('titulo={nombreVisible(p) || "Sin nombre"}');
    expect(VISTA).toContain("const nombreVisible = (p: PatientListItem) => `${p.firstName} ${p.lastName}`");
  });

  it("y las DOS capas ordenan por esa misma cadena", () => {
    // El reader (orden de llegada) y la vista (conmutador). Se comprueban los dos: arreglar uno solo deja
    // el salto al hidratar.
    expect(READER, "el reader volvió a ordenar por apellido").toContain(
      "`${a.firstName} ${a.lastName}`.trim().localeCompare(`${b.firstName} ${b.lastName}`.trim(), \"es\")",
    );
    expect(READER, "el reader ordena por un campo que no se pinta").not.toContain(
      "`${a.lastName} ${a.firstName}`",
    );
    expect(VISTA).toContain('nombreVisible(a).localeCompare(nombreVisible(b), "es")');
  });

  it("y el orden por evaluación reciente deja al final a quien no tiene ninguna", () => {
    // Un paciente sin medir no es "el mas antiguo": colarlo entre las fechas haria leer una antiguedad
    // que no existe.
    expect(VISTA).toContain("if (!a.lastEvaluationDate) return 1;");
    expect(VISTA).toContain("if (!b.lastEvaluationDate) return -1;");
  });
});

describe("la paginación no deja la lista en una página vacía", () => {
  it("al buscar o reordenar vuelve a la primera", () => {
    // Escribir en el buscador estando en la pagina 3 dejaba una pagina vacia, y eso se lee como "la
    // búsqueda no encontró nada", que es una conclusión falsa.
    expect(VISTA).toContain("setPagina(1);");
    expect(VISTA).toContain("const claveVista = `${busqueda.trim()}|${orden}`;");
  });

  it("y el reseteo NO va en un efecto", () => {
    // Con `useEffect` el reseteo ocurre despues de pintar: hay un fotograma con la pagina vieja sobre la
    // lista nueva. Y `react-hooks/set-state-in-effect` lo prohibe. Se ajusta durante el render.
    expect(VISTA, "el reseteo de página volvió a un efecto").not.toContain("useEffect");
  });

  it("y la página se acota además al pintar", () => {
    // Si la lista se acorta por otra via (menos pacientes del servidor), la pagina guardada queda fuera de
    // rango sin que la clave cambie.
    expect(VISTA).toContain("const paginaActual = Math.min(pagina, totalPaginas);");
  });

  it("el paginador solo aparece si hay más de una página", () => {
    // "Página 1 de 1" con las dos flechas apagadas es un mando que no hace nada.
    expect(VISTA).toContain("{totalPaginas > 1 ? (");
  });
});
