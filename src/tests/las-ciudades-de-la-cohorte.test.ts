import { describe, expect, it } from "vitest";

import {
  ciudadesUnificadas,
  formaComparable,
  type FilaDeCiudad,
} from "@/modules/obbia/services/ciudades-de-la-cohorte";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LA MISMA CIUDAD NO SALE EN TRES FILAS  ·  2026-11-03
//
// Santiago, mirando el consolidado de /obbia: *"las ciudades duplicadas («Guarne» / «Guarne, Antioquia»,
// tres «San Carlos»)"*. La ciudad es TEXTO LIBRE que alguien teclea al registrar al paciente, así que no
// es un defecto del panel: es lo que hay en la base. Pero una tabla de caracterización que parte una
// ciudad en tres filas de una consulta dice algo falso sobre la cohorte, y además fabrica celdas pequeñas
// (tres filas de un paciente donde había una de tres).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const fila = (grupo: string, consultas: number, edadMedia: number | null = 40): FilaDeCiudad => ({
  grupo,
  consultas,
  pacientes: consultas,
  conBis: consultas,
  conEspectro: consultas,
  edadMedia,
});

describe("las ciudades de la cohorte", () => {
  it("junta lo que no puede significar otra cosa: acentos, mayúsculas y espacios", () => {
    const r = ciudadesUnificadas([fila("Medellín", 200), fila("MEDELLIN", 5), fila("medellin ", 3)]);
    expect(r).toHaveLength(1);
    expect(r[0].consultas).toBe(208);
    // Y EL NOMBRE QUE SE MUESTRA es el más completo del grupo: el que lleva sus acentos.
    expect(r[0].grupo).toBe("Medellín");
  });

  it("y recorta la cola SOLO si la forma corta ya existe por sí sola", () => {
    // Es la parte conservadora, y no es prudencia abstracta: hay municipios homónimos en departamentos
    // distintos, así que recortar a ciegas fundiría dos ciudades reales en una. En un consolidado de
    // investigación eso es inventar una cohorte.
    const r = ciudadesUnificadas([
      fila("Guarne", 2),
      fila("Guarne, Antioquia", 1),
      fila("San Carlos", 1),
      fila("San Carlos Antioquia", 1),
      fila("San Carlos Ant", 1),
      // Esta NO se toca: no hay ningún "Anserma" suelto que pruebe que son la misma.
      fila("Anserma Caldas", 1),
    ]);
    const porNombre = Object.fromEntries(r.map((f) => [f.grupo, f.consultas]));
    expect(porNombre["Guarne"]).toBe(3);
    expect(porNombre["San Carlos"]).toBe(3);
    expect(porNombre["Anserma Caldas"], "se fundió una ciudad sin evidencia de que fuera la misma").toBe(1);
    expect(r).toHaveLength(3);
  });

  it("la edad media se repondera por consultas, no se promedia a secas", () => {
    // Promediar medias de grupos de tamaños distintos da un número que no describe a nadie. Con 9
    // consultas a 50 y 1 a 10, la media del grupo es 46, no 30.
    const r = ciudadesUnificadas([fila("Pereira", 9, 50), fila("PEREIRA", 1, 10)]);
    expect(r[0].edadMedia).toBe(46);
  });

  it("y una ciudad sin edad no arrastra la media del grupo a cero", () => {
    // Si entrara con edad 0, la media bajaría por una fila que no aporta ninguna edad. Las filas sin edad
    // no entran al peso.
    const r = ciudadesUnificadas([fila("Cali", 4, 38), fila("CALI", 2, null)]);
    expect(r[0].edadMedia).toBe(38);
    expect(r[0].consultas, "pero sus consultas sí se suman").toBe(6);
  });

  it("la forma comparable ignora acentos, mayúsculas, comas y espacios dobles", () => {
    expect(formaComparable("Guarne,  Antioquia")).toBe("guarne antioquia");
    expect(formaComparable("MEDELLÍN ")).toBe("medellin");
  });

  it("y el resultado sale ordenado por tamaño, que es como se lee una caracterización", () => {
    const r = ciudadesUnificadas([fila("Pereira", 55), fila("Medellín", 285), fila("Cali", 2)]);
    expect(r.map((f) => f.grupo)).toEqual(["Medellín", "Pereira", "Cali"]);
  });
});
