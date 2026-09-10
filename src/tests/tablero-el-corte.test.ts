import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ EL CORTE DEL TABLERO (Santiago, 2026-09-10) ═══
//
// SU CRITICA ES LA QUE LO DEFINE: "el riesgo no es que sea muy clinico. Es que se llene de numeros que
// nadie mira. Un tablero con doce metricas se lee menos que uno con cuatro. Y lo que le importa a un
// profesional que abre Atlas por la mañana es QUE HACER HOY, no cuanto vendio el mes pasado."
//
// ESTE CANDADO EXISTE PORQUE UN TABLERO CRECE SOLO. Cada metrica nueva parece barata por si misma, y la
// suma es lo que lo vuelve ilegible. Lo que se fija aqui no es el aspecto: es el CRITERIO, para que
// añadir la trece obligue a justificarla contra el.

const PAGINA = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
const LECTOR = readFileSync("src/modules/dashboard/data/tablero-reader.ts", "utf8");

describe("arriba solo va lo que lleva a algun sitio", () => {
  it("las tarjetas accionables son pulsables", () => {
    // Una metrica accionable que no lleva a ninguna lista es solo un numero con urgencia: le da al
    // profesional el problema y no la salida.
    expect(PAGINA).toContain('href="/pacientes"');
    expect(PAGINA).toContain('href="/reportes"');
  });

  it("y las próximas consultas llevan a SU evaluación, una por una", () => {
    expect(PAGINA).toContain("href={`/ani-bis-e/${c.evaluationId}`}");
  });

  it("la tarjeta sabe llevar: no es un div con onClick", () => {
    // Es navegacion, asi que tiene que poder abrirse en otra pestaña, copiarse y recorrerse con teclado.
    const TARJETA = readFileSync("src/components/shared/tarjeta-metrica.tsx", "utf8");
    expect(TARJETA).toContain("<Link href={href}");
    expect(sinComentarios(TARJETA), "la tarjeta se volvió pulsable con un handler").not.toContain(
      "onClick",
    );
  });
});

describe("las próximas consultas son un LISTADO, no un número", () => {
  it("se piden con nombre y fecha", () => {
    // "3 consultas esta semana" no dice a quien ni cuando, asi que obliga a ir a buscarlo: la cifra da el
    // trabajo y no la respuesta.
    expect(LECTOR).toContain("proximasConsultas: ProximaConsulta[]");
    expect(PAGINA).toContain("{c.paciente}");
  });

  it("y son TRES, no todas", () => {
    // Un tablero con la agenda entera vuelve a ser una pantalla que hay que leer.
    expect(LECTOR).toContain(".slice(0, 3)");
  });
});

describe("los ceros de USO se distinguen de un sistema roto", () => {
  it("el cero de las citas dice por qué está en cero y qué lo llena", () => {
    // CUIDADO (b) DE SANTIAGO. Hoy son 0 de 16 tratamientos con próxima cita, y no es que falte la pieza:
    // el campo tiene escritor y pantalla en Seguimiento. Decirlo es la diferencia entre esperar y
    // reportar un fallo.
    expect(PAGINA).toContain("Ninguna agendada todavía");
    expect(PAGINA).toContain("Se llena solo");
  });
});

describe("lo informativo va debajo y con menos peso", () => {
  it("las tres del mes están, y son las del PROFESIONAL", () => {
    // "Cuánto facturó CNV" no es su pregunta, y meterla aquí le pondría delante un número sobre el que no
    // puede hacer nada. El agregado es del admin y va en su vista.
    for (const m of ["Tu comisión", "Ventas", "Unidades en inventario"]) {
      expect(PAGINA, `falta la métrica "${m}"`).toContain(m);
    }
    expect(sinComentarios(PAGINA), "entró el agregado de la organización").not.toContain(
      "Ingreso de CNV",
    );
  });

  it("y no usan la tarjeta grande: si se leyeran igual, volvería a ser un tablero de doce cifras", () => {
    const abajo = PAGINA.slice(PAGINA.indexOf("Tu mes"));
    expect(abajo, "lo informativo se pintó con el mismo peso que lo accionable").not.toContain(
      "<TarjetaMetrica",
    );
  });
});

describe("lo retirado NO vuelve", () => {
  it("ni los contadores que solo suben ni los que cuentan lo hecho", () => {
    // Cada uno con su razon, escrita en el lector para que quien quiera devolverlo la lea primero:
    //   · "Pacientes" y "evaluaciones acumuladas": suben y nadie actúa sobre ellos.
    //   · "Sin evaluaciones": es accionable, pero la columna de /pacientes ya lo dice paciente por
    //     paciente y allí sí lleva a algún sitio.
    //   · "Consultas cerradas" y "reportes enviados": cuentan lo hecho, no lo que falta.
    const codigo = sinComentarios(PAGINA);
    for (const fuera of ["Acumuladas desde el inicio", "Sin evaluaciones", "Consultas cerradas"]) {
      expect(codigo, `volvió una métrica retirada: ${fuera}`).not.toContain(fuera);
    }
  });

  it("y la razón de cada retirada sigue escrita", () => {
    expect(LECTOR).toContain("LO QUE SE RETIRO, con su razon");
  });
});

describe("los pendientes salen de la MISMA regla que la columna", () => {
  it("el lector reusa `pendienteDelPaciente`", () => {
    // Si aquí se contara "evaluaciones en progreso" y allí se dijera otra cosa, el tablero y la lista
    // discreparían sobre el mismo paciente, y ninguno de los dos sería el bueno.
    expect(LECTOR).toContain("pendienteDelPaciente(");
  });

  it("y los archivados no cuentan: salieron de la lista a propósito", () => {
    expect(LECTOR).toContain('p.status === "inactive"');
  });
});
