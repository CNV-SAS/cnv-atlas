import { describe, expect, it } from "vitest";

import { PATRON_FIELD_KEYS, resolvePatron } from "@/clinical-engine";
import { respuestasDeLaConsulta, valorParaAtlas } from "@/modules/importacion-html/services/mapeo-de-la-consulta";

// ═══ LO QUE EL IMPORTADOR ESCRIBE, ¿LO SABE LEER EL MOTOR? (2026-09-23) ═══
//
// ESTE CRUCE NO EXISTIA, y por eso el defecto salio en produccion y no en la suite. Habia candados de sobra a
// cada lado: uno ancla los textos del frozen contra la semilla, otro prueba que el reader detecta una opcion
// mal escrita, otro que el ICEC exige sus ocho insumos. Ninguno preguntaba lo unico que importaba: si lo que
// el importador GUARDA es lo que el reader SABE LEER.
//
// El defecto: el HTML guarda la frecuencia como el INDICE de la opcion (0-4) y Atlas guarda el TEXTO. Al
// copiarla tal cual, las 18 preguntas del patron quedaban en "1", "4", "0".
//
// Y LO PEOR NO ERA VERSE VACIO. El reader las marcaba ilegibles y avisaba a Sentry, pero el ICEC SI se
// calculaba: su guarda mira PRESENCIA, y "1" esta presente. Alimentacion salia baja para todo paciente
// importado, en silencio, y de ahi a la edad biologica y al ICEC. Un dato en la forma equivocada es peor que
// un dato ausente, porque las guardas de ausencia no lo ven.

const CLAVES = PATRON_FIELD_KEYS;

describe("el patrón alimentario sobrevive al viaje desde el HTML", () => {
  it("la frecuencia del HTML es un ORDINAL y se guarda como el texto canónico", () => {
    // Lo que trae una consulta del HTML: numeros, no textos.
    const consulta: Record<string, unknown> = {};
    for (const clave of CLAVES) consulta[clave] = 0;
    consulta.d1_1_i = 4; // "Todos los días"
    consulta.d1_2_i = 2; // "3–4 días"

    const filas = respuestasDeLaConsulta(consulta, CLAVES);
    const porClave = new Map(filas.map((f) => [f.clave, f.valor]));

    expect(porClave.get("d1_1_i")).toBe("Todos los días");
    expect(porClave.get("d1_2_i")).toBe("3–4 días");
    expect(porClave.get("d1_3_i")).toBe("Nunca");
    // Los horarios tienen su propio juego de opciones, no el de frecuencia.
    expect(porClave.get("d1f_des_i")).toBe("Sí, todos los días");
  });

  it("y el motor las lee: el patrón queda OK, no ilegible", () => {
    const consulta: Record<string, unknown> = {};
    CLAVES.forEach((clave, i) => {
      consulta[clave] = i % 5 === 0 ? 0 : 1;
    });
    const filas = respuestasDeLaConsulta(consulta, CLAVES);

    const resolucion = resolvePatron(
      [...CLAVES],
      filas.map((f) => ({ fieldKey: f.clave, answerValue: f.valor })),
    );
    // ESTA ES LA ASERCION QUE FALTABA: con el defecto vivo, esto es "ilegible".
    expect(resolucion.status, "el motor no supo leer lo que el importador guardó").toBe("ok");
  });

  it("un ordinal que no existe NO se inventa: se deja crudo para que la revisión lo marque", () => {
    // Si el HTML trajera un 9 en una pregunta de cinco opciones, guardar una opcion plausible seria peor que
    // no guardarla: quedaria una respuesta falsa indistinguible de una real.
    expect(valorParaAtlas("d1_1_i", 9)).toBe("9");
    expect(valorParaAtlas("d1_1_i", 4)).toBe("Todos los días");
  });

  it("lo que no es del patrón no se toca: un número sigue siendo su número", () => {
    // d3_29 es una pregunta numerica de verdad (una cantidad), no una opcion.
    expect(valorParaAtlas("d3_29", 10)).toBe("10");
    expect(valorParaAtlas("d2_21", ["Ninguno"])).toBe('["Ninguno"]');
    expect(valorParaAtlas("d3_24", "15–30 min")).toBe("15–30 min");
    expect(valorParaAtlas("d1_1_i", "")).toBeNull();
  });
});
