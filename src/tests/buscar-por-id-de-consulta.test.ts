import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LA BARRA DE PACIENTES ENCUENTRA POR ID DE CONSULTA  ·  2026-11-03
//
// ═══ DE DONDE SALE ═══
//
// Santiago: *"No me acuerdo qué paciente tenía este ID. Sería bueno que al buscar por esos ids en la
// barra de búsqueda de pacientes también apareciera: «ed83ff97»."*
//
// Y ESE FORMATO ABREVIADO NO ES CAPRICHOSO: es con el que Gildardo nombra los casos en sus anexos y con
// el que nosotros le contestamos, precisamente para no escribir nombres de pacientes en documentos que
// circulan. La abreviatura ya es el vocabulario común de los dos lados; lo que faltaba era el camino de
// vuelta, de la abreviatura a la persona, sin consultar la base.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const LISTA = sinComentarios(
  readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8"),
);

describe("buscar por id de consulta", () => {
  it("busca por PREFIJO, que es lo que se cita", () => {
    // Exigir el UUID entero dejaría fuera justo el caso que lo motiva: ocho caracteres es lo que aparece
    // en sus anexos y en nuestros documentos.
    expect(LISTA).toContain("e.evaluationId.toLowerCase().startsWith(q)");
  });

  it("y solo cuando lo escrito PARECE un id", () => {
    // Sin este freno, teclear "a" haría coincidir medio listado por los ids y la búsqueda por nombre
    // dejaría de servir. Es el mismo defecto que una búsqueda que devuelve todo: deja de ser búsqueda.
    expect(LISTA).toContain("q.length < 6");
    expect(LISTA).toContain("/^[0-9a-f-]+$/.test(q)");
  });

  it("sin perder el nombre ni el documento, que son las dos formas de siempre", () => {
    expect(LISTA).toContain("nombre.includes(q)");
    expect(LISTA).toContain("p.documentNumber.toLowerCase().includes(q)");
  });

  it("y el campo DICE que ahora también busca por id", () => {
    // Una búsqueda que encuentra algo que su rótulo no promete no la usa nadie: el que tiene el id en la
    // mano no se le ocurre pegarlo en un campo que dice "nombre o documento".
    expect(LISTA).toContain("Buscar por nombre, documento o id de consulta");
    // Y EL NOMBRE ACCESIBLE TAMBIÉN: el placeholder se borra al escribir y algunos lectores no lo leen.
    expect(LISTA).toContain("nombre, número de documento o id de consulta");
  });

  it("no se limita por rol, y la razón está escrita", () => {
    // La lista YA es la de los pacientes que esta sesión puede ver (la RLS la filtró antes de llegar
    // aquí), así que buscar por id no alcanza ni una fila más que buscar por nombre. Un filtro por rol
    // daría una sensación de control que no aporta nada.
    expect(LISTA, "apareció un filtro por rol en una búsqueda sobre datos ya filtrados").not.toMatch(
      /esAdmin|isAdmin|hasAnyRole/,
    );
  });
});
