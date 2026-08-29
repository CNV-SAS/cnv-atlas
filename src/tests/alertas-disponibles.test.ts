import { describe, expect, it } from "vitest";

import {
  alertasDisponibles,
  motivoDeExclusion,
} from "@/clinical-engine/alertas-disponibles";
// Modulo congelado en JS; `allowJs` lo resuelve.
import { generarAlertas } from "@/clinical-engine/frozen/atlas-alertas.js";
import { readFileSync } from "node:fs";
import { constFlechaDelHtml } from "./fixtures/html-vigente";

// CANDADO DE `generarAlertas`, en tres niveles:
//   1. TRANSCRIPCION: el frozen es byte a byte su funcion. Se coteja, no se cree.
//   2. QUE SI CORRE: la unica regla con todos sus insumos hoy.
//   3. QUE NO CORRE Y POR QUE, que es lo que evita que dentro de un mes alguien lea el silencio como
//      "el paciente esta bien" en vez de "no lo estamos evaluando".

describe("generarAlertas: transcripción verbatim del archivo de Gildardo", () => {
  it("el módulo portado contiene su función entera, sin una sola diferencia", () => {
    // Por NOMBRE y contra la entrega DERIVADA, nunca por rango de lineas ni por ruta literal.
    const fuente = constFlechaDelHtml("generarAlertas");
    const portado = readFileSync("src/clinical-engine/frozen/atlas-alertas.js", "utf8");
    expect(portado).toContain(fuente);
    expect(fuente).toContain("const generarAlertas = (enc, cons, get, rda, peso)");
  });
});

const enc = (extra: Record<string, unknown> = {}) => ({
  d5_39: [] as string[],
  d6_43: [] as string[],
  d2_21: [] as string[],
  ...extra,
});

describe("la única regla que hoy tiene todos sus insumos", () => {
  it("TCA activo: se dispara con una bandera del ítem 21, que Atlas sí captura", () => {
    const al = alertasDisponibles(enc({ d2_21: ["Laxantes"] }));
    expect(al.map((a) => a.t)).toEqual(["TCA activo detectado"]);
    expect(al[0].niv).toBe("crítico");
    // El texto es el suyo, sin retocar: es lo que el profesional lee para decidir una derivación.
    expect(al[0].txt).toContain("Derivación urgente");
  });

  it("y NO se dispara sin banderas: un paciente limpio no genera ninguna alerta", () => {
    expect(alertasDisponibles(enc())).toEqual([]);
  });
});

describe("las catorce que hoy NO pueden correr, y el motivo de cada grupo", () => {
  it("las DIEZ de consumo se apagan solas con los insumos vacíos, sin lista blanca", () => {
    // Si alguna de estas apareciera, seria que se esta evaluando el cuadro nutricional con ceros, que es
    // peor que no evaluarlo: un cero afirma "consume cero", no "no lo sabemos".
    const al = alertasDisponibles(enc({ d5_39: ["Diabetes tipo 2"] })).map((a) => a.t);
    for (const t of [
      "Sodio excesivo",
      "Déficit calórico severo",
      "Exceso calórico marcado",
      "Proteína insuficiente para nivel de actividad",
      "Fibra muy baja",
      "Déficit de hierro",
      "Calcio insuficiente",
      "Alergia a lácteos + calcio deficiente",
      "Excelente ingesta de fibra",
      "Buena ingesta de Omega-3",
    ]) {
      expect(al, `${t} no debería poder correr sin cons`).not.toContain(t);
    }
  });

  it("las CUATRO de campos inexistentes: el candado va sobre la CAPTURA, no sobre la regla", () => {
    // CORRECCION A MI PRIMER PLANTEO, que estaba mal: su funcion SI lee d1_14/d1_15/d1_16, asi que si el
    // dato estuviera, la regla se disparara. Lo que no ocurre nunca es que el dato ESTE. Son tres piezas
    // distintas (el codigo, la captura y la condicion) y aqui la que falla es la CAPTURA: la encuesta
    // vigente tiene quince items `_i` y no tiene ninguno de esos tres codigos.
    //
    // Por eso el candado mira el SEED, que es donde se decide que se le pregunta al paciente.
    const seed = readFileSync("supabase/seed.ts", "utf8");
    for (const k of ["d1_14", "d1_15", "d1_16"]) {
      expect(seed.includes(`key: "${k}"`), `${k} no debería existir en la encuesta`).toBe(false);
    }
    // Y con un enc como el que Atlas construye de verdad, ninguna de las tres se dispara.
    const real = alertasDisponibles(enc({ d5_39: ["Diabetes tipo 2"], d3_29: 9, d1_13_i: "Diario" }));
    expect(real.map((a) => a.t)).toEqual([]);
  });

  it("y la deshidratación se excluye EXPLÍCITAMENTE, porque no está muerta: miente", () => {
    // Es la unica de las cuatro que su funcion SI emitiria: `agua <= 3` con agua siempre 0 se cumple
    // siempre, asi que la regla se reduce a la orina oscura y el texto afirma "Agua: 0 vasos".
    const conOrinaOscura = enc({ d7_58: "Oscuro (naranja / marrón)" });
    expect(alertasDisponibles(conOrinaOscura).map((a) => a.t)).not.toContain(
      "Deshidratación probable",
    );
    expect(motivoDeExclusion("Deshidratación probable")).toContain("d1_16");
    // CONTROL NEGATIVO, y hace falta: si su funcion NO emitiera la alerta, el filtro estaria tapando
    // algo que ya no ocurre y el verde no diria nada. Se corre el frozen CRUDO, sin adaptador.
    const crudas = (generarAlertas(conOrinaOscura, {}, 0, {}, 0) as { t: string }[]).map((a) => a.t);
    expect(crudas).toContain("Deshidratación probable");
    expect(motivoDeExclusion("TCA activo detectado")).toBe(null);
  });
});
