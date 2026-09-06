import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { fechaSugerida } from "@/modules/followups/data/proximo-control";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PUNTO 27 (cuarto smoke, 2026-09-06). Tres cosas que se decidieron juntas.
//
// (a) LA FECHA SUGERIDA SE CUENTA DESDE LA CONSULTA, no desde la toma del BIS. Hasta aquí el ancla era
//     `bis_measurements.measurement_date`. La razón es de Santiago y es de futuro: hoy da igual porque la
//     toma se hace EN la consulta, pero el día que el paciente venga con el BIS hecho días antes, el
//     intervalo clínico no cuenta desde el aparato, cuenta desde que se le vio. Ese día, contarlo desde la
//     toma citaría a los pacientes demasiado pronto y nadie lo notaría.
//
// (b) LA FRECUENCIA NO SE HACE EDITABLE, y ahí Atlas ya hace más que su archivo: él pone un campo de texto
//     libre; nosotros ponemos la que el MODELO deriva de la ruta y dejamos cambiar la FECHA, que es la
//     decisión que el profesional toma de verdad. Lo que sí cambia es que la frecuencia se VE.
//
// (c) OBSERVACIONES no se construye: va con el bloque global de notas, que queda pendiente.

const READER = sinComentarios(
  readFileSync("src/modules/followups/data/proximo-control-reader.ts", "utf8"),
);
const PANTALLA = sinComentarios(
  readFileSync("src/modules/followups/components/proximo-control.tsx", "utf8"),
);

describe("27a · la sugerencia se ancla en la CONSULTA", () => {
  it("el lector lee la fecha de la evaluación y cuenta desde ahí", () => {
    expect(READER).toContain('.from("evaluations")');
    expect(READER).toContain('.select("created_at")');
    expect(READER).toContain("fechaSugerida(fechaConsulta ?? fechaMedicion");
  });

  it("y cae a la de la toma sólo si no hay fecha de consulta", () => {
    // Mejor una sugerencia contada desde la toma que ninguna: el profesional puede cambiarla igual.
    expect(READER).toContain("fechaConsulta ?? fechaMedicion");
  });

  it("la cuenta sigue siendo la misma: fecha + los días de la frecuencia", () => {
    // El cálculo no cambió, cambió su ancla. Se prueba ejecutándolo.
    expect(fechaSugerida("2026-09-04", "Cada 90 días")).toBe("2026-12-03");
    expect(fechaSugerida("2026-07-13", "Cada 90 días")).toBe("2026-10-11");
    expect(fechaSugerida(null, "Cada 90 días")).toBeNull();
  });
});

describe("27b · la frecuencia se ve, y el texto dice la verdad sobre a dónde va la fecha", () => {
  it("la frecuencia del modelo tiene su propia línea, no va escondida en el párrafo gris", () => {
    expect(PANTALLA).toContain("Frecuencia recomendada por el modelo:");
    expect(PANTALLA).toContain("{vista.ruta.frecuencia}");
  });

  it("y dice que el profesional puede poner otra", () => {
    expect(PANTALLA).toContain("puedes poner otra");
  });

  it("EL TEXTO CORREGIDO: la fecha va SIEMPRE a la historia clínica, y al paciente sólo si empeoró", () => {
    // ESTE CASO EXISTE POR UN TEXTO QUE DECÍA DE MÁS. Afirmaba que la fecha "cambia también en el reporte
    // del paciente", y eso sólo es cierto en UNA rama: el reporte del paciente sólo imprime la cita cuando
    // se confirma un cambio desfavorable (su Q33, §6). En la historia clínica sí sale siempre.
    expect(PANTALLA).toContain("historia clínica");
    expect(PANTALLA).toContain("confirma un cambio desfavorable");
    expect(PANTALLA, "el texto viejo prometía de más").not.toContain(
      "cambia también en el reporte",
    );
  });

  it("y la etiqueta del campo dice contra qué se cuenta la sugerencia", () => {
    expect(PANTALLA).toContain("contada desde esta consulta");
  });
});

describe("27c · observaciones NO se construye", () => {
  it("no hay campo de observaciones en el bloque", () => {
    // Va con el bloque global de notas (decisión de Santiago). Si aparece uno suelto aquí, es que se
    // construyó por fuera de esa decisión.
    expect(PANTALLA.toLowerCase()).not.toContain("observaciones");
  });
});
