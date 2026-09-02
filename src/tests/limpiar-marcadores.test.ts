import { describe, expect, it } from "vitest";

import {
  limpiarMarcadores,
  traiaMarcadores,
} from "@/lib/ai/limpiar-marcadores";

// CANDADO DEL FILTRO DE MARCADORES (Gildardo §8, 2026-09-01).
//
// Su frase, que es la razón por la que el filtro existe además del prompt: "a la salida, un filtro que
// limpia esos marcadores POR SI EL MODELO DESOBEDECE, QUE ES LO QUE HACEN". Un prompt baja la frecuencia;
// no la lleva a cero.
//
// LO QUE ESTE CANDADO CUIDA MÁS QUE EL LIMPIADO: que NO se coma contenido. Un filtro sobre texto clínico
// que además recorta la redacción estaría editando lo que un profesional va a leer y firmar.

describe("quita los marcadores que él enumeró", () => {
  it.each([
    ["negrita", "El paciente **presenta** un patrón", "El paciente presenta un patrón"],
    ["cursiva con asterisco", "Un patrón *compatible* con", "Un patrón compatible con"],
    ["negrita con guion bajo", "Riesgo __alto__ en el dominio", "Riesgo alto en el dominio"],
    ["cursiva con guion bajo", "Riesgo _alto_ en el dominio", "Riesgo alto en el dominio"],
    ["encabezado", "## Interpretación\nEl perfil sugiere", "Interpretación\nEl perfil sugiere"],
    ["viñeta", "- Primer hallazgo\n- Segundo", "Primer hallazgo\nSegundo"],
    ["separador", "Primer párrafo\n---\nSegundo párrafo", "Primer párrafo\n\nSegundo párrafo"],
    ["cita", "> Los indicadores sugieren", "Los indicadores sugieren"],
    ["código en línea", "El valor de `IFC` es", "El valor de IFC es"],
    ["emoji", "Buen pronóstico 😀 en el seguimiento", "Buen pronóstico  en el seguimiento"],
  ])("%s", (_n, entrada, esperado) => {
    expect(limpiarMarcadores(entrada)).toBe(esperado);
  });

  it("una tabla se convierte en texto legible, no se borra", () => {
    // Borrar la fila entera perdería los datos. Se conserva el contenido con un separador que se lee.
    const tabla = "| Indicador | Valor |\n|---|---|\n| IFC | 1,2 |";
    expect(limpiarMarcadores(tabla)).toBe("Indicador · Valor\n\nIFC · 1,2");
  });

  it("y un bloque de código conserva lo de dentro", () => {
    expect(limpiarMarcadores("```\nun texto\n```")).toBe("un texto");
  });
});

describe("NO se come el contenido, que es lo que más importa", () => {
  it("un guion DENTRO de una frase se queda", () => {
    // "no-evaluable", "ANI-BIS-E", los rangos "1,7-2,1". Si el filtro los tocara, estaría editando texto
    // clínico. Solo se quita el guion que ABRE una viñeta o el que forma una línea de separación.
    const t =
      "El perfil ANI-BIS-E queda no-evaluable con un IRC de 1,7-2,1 en el corte.";
    expect(limpiarMarcadores(t)).toBe(t);
  });

  it("dos asteriscos sueltos y lejanos NO se cierran sobre el párrafo", () => {
    // El borde que rompe un filtro ingenuo: sin exigir contenido sin saltos de línea, un `*` al principio
    // y otro tres párrafos después se leerían como énfasis y se comerían todo lo de en medio.
    const t =
      "Primer párrafo con un * suelto.\n\nSegundo párrafo.\n\nTercero con otro * suelto.";
    expect(limpiarMarcadores(t)).toBe(t);
  });

  it("las tildes, las eñes y los signos del español no se tocan", () => {
    const t =
      "¿Se observa una alteración en el patrón? Sí: el año pasado ya había señales.";
    expect(limpiarMarcadores(t)).toBe(t);
  });

  it("un texto ya limpio sale idéntico", () => {
    const t =
      "Los indicadores son compatibles con un patrón de riesgo cardiometabólico incipiente. El perfil " +
      "sugiere priorizar la composición corporal antes que la restricción calórica.";
    expect(limpiarMarcadores(t)).toBe(t);
    expect(traiaMarcadores(t)).toBe(false);
  });
});

describe("el caso completo: lo que el modelo devuelve de verdad", () => {
  it("un borrador con markdown queda en prosa, sin perder una frase", () => {
    const delModelo = [
      "## Interpretación clínica",
      "",
      "Los indicadores son **compatibles** con un patrón de _riesgo cardiometabólico_.",
      "",
      "- El IFC está por encima del corte.",
      "- El ángulo de fase se mantiene en rango.",
      "",
      "---",
      "",
      "> Se sugiere priorizar la composición corporal.",
    ].join("\n");
    const limpio = limpiarMarcadores(delModelo);
    expect(limpio).not.toContain("**");
    expect(limpio).not.toContain("##");
    expect(limpio).not.toContain("---");
    expect(limpio).not.toContain(">");
    // Y las cuatro frases siguen ahí, enteras.
    expect(limpio).toContain("Interpretación clínica");
    expect(limpio).toContain(
      "compatibles con un patrón de riesgo cardiometabólico",
    );
    expect(limpio).toContain("El IFC está por encima del corte.");
    expect(limpio).toContain("Se sugiere priorizar la composición corporal.");
    expect(traiaMarcadores(delModelo)).toBe(true);
  });
});
