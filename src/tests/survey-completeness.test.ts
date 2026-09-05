import { readFileSync } from "node:fs";
import { sinComentarios } from "./helpers/sin-comentarios";
import { describe, expect, it } from "vitest";

import {
  computeSurveyGaps,
  formatIncompleteSurveyMessage,
  isAnswered,
  totalMissing,
} from "@/modules/clinical-pipeline/services/survey-completeness";

// Gate de encuesta COMPLETA (las 64, no solo las 13 del diagnostico). El helper es puro; aqui se fija
// el criterio de "respondida" (ausente vs cero) y el mensaje por dominio.

describe("survey-completeness", () => {
  it("isAnswered distingue ausente/vacio de un cero real", () => {
    expect(isAnswered(null)).toBe(false); // sin fila (LEFT JOIN)
    expect(isAnswered("")).toBe(false); // vacio
    expect(isAnswered("[]")).toBe(false); // multi sin marcar
    expect(isAnswered("0")).toBe(true); // contador tocado en cero: SI es respuesta
    expect(isAnswered("No")).toBe(true);
    expect(isAnswered('["Ninguna"]')).toBe(true);
    // "otra" elegida SIN texto -> incompleta (hueco del gate); con texto -> completa.
    expect(isAnswered('["Otra"]')).toBe(false);
    expect(isAnswered('["Otros"]')).toBe(false);
    // Las cuatro flexiones peladas cuentan como hueco (el detector cubre otra/otro/otras/otros, no solo dos).
    expect(isAnswered('["Otro"]')).toBe(false);
    expect(isAnswered('["Otras"]')).toBe(false);
    expect(isAnswered('["Cáncer","Otra"]')).toBe(false); // una eleccion valida + "otra" pelada -> hueco
    expect(isAnswered('["Otra: penicilina"]')).toBe(true);
    expect(isAnswered('["Otro: bypass"]')).toBe(true); // "otro" con texto -> completa
    expect(isAnswered('["Cáncer"]')).toBe(true);
    // OPCION UNICA con "Otra" pelada: se guarda como token PLANO (no arreglo). Tambien es hueco (bug P61).
    expect(isAnswered("Otra")).toBe(false);
    expect(isAnswered("Otro")).toBe(false);
    expect(isAnswered("Otras")).toBe(false);
    expect(isAnswered("Otros")).toBe(false);
    expect(isAnswered("Otra: bypass gástrico")).toBe(true); // opcion unica "Otra" CON texto -> respondida
    expect(isAnswered("Sí")).toBe(true); // una opcion unica normal sigue contando
    // EL CASO DE SANTIAGO (2026-08-20, 3er intento): "Otra" con el campo vacio o con SOLO UN ESPACIO. El
    // widget trima y emite el token pelado, pero se blinda tambien el valor con ":" y espacios: es "eligio
    // otra sin especificar", sigue siendo hueco. En multi y en unica.
    expect(isAnswered("Otra:")).toBe(false);
    expect(isAnswered("Otra: ")).toBe(false); // colon + espacio
    expect(isAnswered("Otra :")).toBe(false);
    expect(isAnswered('["Otra: "]')).toBe(false); // multi, colon + espacio
    expect(isAnswered('["Cáncer","Otra: "]')).toBe(false); // valida + "otra" con espacio -> hueco
    expect(isAnswered("Otra: x")).toBe(true); // con texto real (aunque corto) -> respondida
  });

  it("una pregunta NO de diagnostico sin responder bloquea (un contador de D7)", () => {
    const gaps = computeSurveyGaps([
      { section: "Hábitos", orderIndex: 10, answerValue: "2" },
      { section: "Hidratación", orderIndex: 50, answerValue: null }, // contador sin tocar
    ]);
    expect(gaps).toEqual([{ section: "Hidratación", missing: 1 }]);
    expect(totalMissing(gaps)).toBe(1);
  });

  it("completa (todas respondidas, incluido un cero) -> sin huecos", () => {
    const gaps = computeSurveyGaps([
      { section: "Hidratación", orderIndex: 50, answerValue: "0" }, // "Ninguno" explicito
      { section: "Hábitos", orderIndex: 10, answerValue: "No" },
    ]);
    expect(gaps).toEqual([]);
  });

  it("agrupa por dominio en el ORDEN de la encuesta y cuenta", () => {
    const gaps = computeSurveyGaps([
      { section: "Percepción corporal", orderIndex: 5, answerValue: null },
      { section: "Hidratación", orderIndex: 50, answerValue: null },
      { section: "Percepción corporal", orderIndex: 6, answerValue: null },
    ]);
    // Percepción corporal aparece primero (orderIndex 5) y suma 2; Hidratación 1.
    expect(gaps).toEqual([
      { section: "Percepción corporal", missing: 2 },
      { section: "Hidratación", missing: 1 },
    ]);
  });

  it("el mensaje dice cuantas faltan, por dominio, y el verbo (generar/regenerar)", () => {
    const gaps = [
      { section: "Percepción corporal", missing: 2 },
      { section: "Hidratación", missing: 1 },
    ];
    const msg = formatIncompleteSurveyMessage(gaps);
    expect(msg).toContain("faltan 3 respuestas");
    expect(msg).toContain("Percepción corporal (2)");
    expect(msg).toContain("Hidratación (1)");
    expect(msg).toContain("antes de generar el diagnóstico");
    expect(formatIncompleteSurveyMessage(gaps, "regenerar")).toContain("antes de regenerar el diagnóstico");
    // Singular.
    expect(formatIncompleteSurveyMessage([{ section: "Hidratación", missing: 1 }])).toContain("falta 1 respuesta");
  });
});

describe("las dos pantallas públicas de encuesta no estiran su tarjeta (cotejo 1)", () => {
  // EL DEFECTO: `main` es un flex en fila con `min-h-svh`, así que `align-items: stretch` estiraba la
  // tarjeta a la altura de la pantalla. Con el formulario largo no se notaba, porque el contenido ya
  // llenaba la altura; solo se veía en los estados CORTOS ("Encuesta completada", "Enlace no válido",
  // "Retiraste tu autorización"), que son justo los que ve un paciente que vuelve al enlace: dos líneas
  // dentro de un recuadro vacío de mil píxeles.
  //
  // Se vigilan las DOS páginas, no la que se reportó: la misma shell estaba copiada en las dos y solo una
  // tenía captura.
  const PAGINAS = [
    "src/app/(public)/encuesta/[token]/page.tsx",
    "src/app/(public)/encuesta/reanudar/[token]/page.tsx",
  ];

  it("cada `main` con min-h-svh declara su alineación en el eje transversal", () => {
    for (const p of PAGINAS) {
      // SIN COMENTARIOS: el comentario que explica este defecto NOMBRA `min-h-svh`, así que el candado se
      // cazaba a sí mismo. Es la quinta vez de esa forma, y por eso el helper existe desde hace tiempo.
      const src = sinComentarios(readFileSync(p, "utf8"));
      const mains = src.split("\n").filter((l) => l.includes("min-h-svh"));
      expect(mains.length, `no encontré el contenedor en ${p}`).toBeGreaterThan(0);
      for (const linea of mains) {
        expect(
          /items-(start|center|end)/.test(linea),
          `sin alineación, la tarjeta se estira a la pantalla y un mensaje corto sale en un recuadro vacío: ${p}`,
        ).toBe(true);
      }
    }
  });
});
