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
// EL ORDEN BASE salio del lector en la 0228: vive en `ordenarElRoster`, en el modulo puro.
const READER = sinComentarios(
  readFileSync("src/modules/patients/roster-fila.ts", "utf8"),
);

describe("se ordena por lo que se ve", () => {
  it("la fila pinta `nombre apellido`", () => {
    // El ancla de todo lo demas: si algun dia la fila pasa a "Apellido, Nombre", los dos ordenes de abajo
    // dejan de ser los correctos y este caso obliga a mirarlo.
    expect(VISTA).toContain('titulo={nombreVisible(p) || "Sin nombre"}');
    expect(READER).toContain("return `${p.firstName} ${p.lastName}`.trim();");
    expect(READER, "el nombre visible volvió a armarse por apellido").not.toContain(
      "`${p.lastName} ${p.firstName}`",
    );
  });

  // ═══ LAS DOS CAPAS YA NO "COINCIDEN": COMPARTEN LA FUNCION (2026-10-30) ═══
  //
  // Antes este bloque comprobaba que el comparador del lector y el de la vista dijeran lo mismo, cada uno
  // escrito en su archivo. Eso es comparar dos copias: pasa verde mientras las dos digan lo mismo, y el
  // dia que una cambie el candado nombra el sintoma (el salto al hidratar) en vez de impedirlo. Ahora los
  // dos ordenes viven una sola vez en `roster-fila` y lo que se prohibe es volver a escribirlos.
  it("y las DOS capas ordenan con la MISMA funcion, no con dos copias", () => {
    expect(READER).toContain("export function porNombreVisible");
    expect(READER).toContain("export function porEvaluacionReciente");
    expect(VISTA).toContain(
      'sort(orden === "alfabetico" ? porNombreVisible : porEvaluacionReciente)',
    );
    // Y LA VISTA NO VUELVE A COMPARAR POR SU CUENTA: un `localeCompare` suyo seria la segunda copia.
    expect(VISTA, "la vista volvió a escribir su propio orden").not.toContain("localeCompare");
    expect(VISTA, "la vista volvió a mirar la fecha por su cuenta").not.toContain(
      "lastEvaluationDate",
    );
  });

  it("y el orden por evaluación reciente deja al final a quien no tiene ninguna", () => {
    // Un paciente sin medir no es "el mas antiguo": colarlo entre las fechas haria leer una antiguedad
    // que no existe.
    expect(READER).toContain("if (!a.lastEvaluationDate) return 1;");
    expect(READER).toContain("if (!b.lastEvaluationDate) return -1;");
  });

  // ═══ EL ORDEN POR DEFECTO, Y QUE SEA EL MISMO EN LAS DOS CAPAS (v12 §1.1, 2026-10-30) ═══
  it("la lista abre por la consulta MAS RECIENTE, servidor y pantalla", () => {
    // Su cambio: *"ahora sale por la ultima consulta, la mas reciente arriba; el nombre solo desempata"*.
    expect(READER, "el orden base volvió a ser alfabético").toContain(
      "return items.sort(porEvaluacionReciente);",
    );
    expect(VISTA).toContain('const ORDEN_INICIAL: Orden = "reciente";');
    expect(VISTA).toContain("useState<Orden>(ORDEN_INICIAL)");
  });

  it("y cada orden dice con una flecha hacia donde corre", () => {
    // "Evaluación reciente" se entiende igual de bien como la más nueva arriba o como la más vieja, y con
    // el orden alfabético por defecto esa duda no existía. Las DOS flechas van, también la del inactivo:
    // es lo que deja anticipar cómo quedaría la lista antes de pulsar.
    expect(VISTA).toContain('["alfabetico", "A-Z", ArrowDownAZ,');
    expect(VISTA).toContain("ArrowDown10,");
    expect(VISTA).toContain('<Flecha aria-hidden className="size-3.5" />');
    // Y EN PALABRAS, no solo en el icono: un icono sin rótulo accesible no dice nada a un lector de
    // pantalla, y la dirección es justo lo que hay que saber para leer la primera fila.
    expect(VISTA).toContain('"Ordenar por última consulta, la más reciente arriba"');
    expect(VISTA).toContain("aria-label={rotuloCompleto}");
  });
});

describe("la paginación no deja la lista en una página vacía", () => {
  it("al buscar o reordenar vuelve a la primera", () => {
    // Escribir en el buscador estando en la pagina 3 dejaba una pagina vacia, y eso se lee como "la
    // búsqueda no encontró nada", que es una conclusión falsa.
    expect(VISTA).toContain("setPagina(1);");
    // EL ANCLA SE AMPLÍA, NO LA ASERCIÓN (2026-09-10): el filtro de archivados entra en la clave, porque
    // encenderlo también cambia cuántas filas hay y deja la página 3 vacía igual que una búsqueda. Lo que
    // se afirma sigue siendo lo mismo: que la clave incluye TODO lo que cambia el resultado.
    expect(VISTA).toContain("const claveVista = `${busqueda.trim()}|${orden}|${verArchivados}`;");
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
