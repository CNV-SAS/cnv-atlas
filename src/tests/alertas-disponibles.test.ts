import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { alertasDisponibles } from "@/clinical-engine/alertas-disponibles";
import { constFlechaDelHtml } from "./fixtures/html-vigente";

// CANDADO DE `generarAlertas`, en tres niveles:
//   1. TRANSCRIPCION: el frozen es byte a byte su funcion. Se coteja, no se cree.
//   2. QUE CORRE HOY: las cinco reglas que leen la encuesta, con su traduccion de campos.
//   3. QUE NO CORRE Y POR QUE, para que dentro de un mes nadie lea el silencio como "el paciente esta
//      bien" en vez de "no lo estamos evaluando".
//
// CORRECCION A LO QUE ESTE ARCHIVO AFIRMABA AYER, y la leccion vale mas que el codigo: di por abierta una
// pregunta que Gildardo YA HABIA CONTESTADO. Su respuesta del 2026-08-28, punto 11b: "Las dos leen el
// grupo equivocado y las dos deben leer d1_13... Portenla YA CON LA CORRECCION; no la porten literal para
// que yo la arregle despues". Yo habia concluido justo lo contrario (dejarlas literales y preguntarle),
// con un argumento que sonaba bien: que corregir haria discrepar Atlas de su archivo en el cotejo. El
// argumento era correcto y la conclusion equivocada, porque el ya habia decidido esa disyuntiva.

describe("generarAlertas: transcripción verbatim del archivo de Gildardo", () => {
  it("el módulo portado contiene su función entera, sin una sola diferencia", () => {
    // Por NOMBRE y contra la entrega DERIVADA, nunca por rango de lineas ni por ruta literal. La
    // traduccion de campos vive en el adaptador para que ESTO siga siendo cierto.
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

describe("las cinco reglas que hoy tienen todos sus insumos", () => {
  it("TCA activo: se dispara con una bandera del ítem 21", () => {
    const al = alertasDisponibles(enc({ d2_21: ["Laxantes"] }));
    expect(al.map((a) => a.t)).toEqual(["TCA activo detectado"]);
    expect(al[0].niv).toBe("crítico");
    // El texto es el suyo, sin retocar: es lo que el profesional lee para decidir una derivación.
    expect(al[0].txt).toContain("Derivación urgente");
  });

  it("riesgo glucémico: DM2 más azúcares frecuentes, leyendo d1_13 como él indicó", () => {
    // "3–4 días" es el indice 2 de FREQ_OPC, y su condicion es `>= 2`.
    const al = alertasDisponibles(
      enc({ d5_39: ["Diabetes tipo 2"], d1_13_i: "3–4 días" }),
    ).map((a) => a.t);
    expect(al).toContain("Riesgo glucémico crítico");
  });

  it("y NO se dispara con la misma diabetes y azúcares poco frecuentes", () => {
    // Control del UMBRAL, no solo de la regla: "1–2 días" es el indice 1, por debajo de su `>= 2`.
    const al = alertasDisponibles(
      enc({ d5_39: ["Diabetes tipo 2"], d1_13_i: "1–2 días" }),
    ).map((a) => a.t);
    expect(al).not.toContain("Riesgo glucémico crítico");
  });

  it("estrés alto más azúcares: la segunda que él mandó apuntar a d1_13", () => {
    const al = alertasDisponibles(enc({ d3_29: 8, d1_13_i: "Todos los días" })).map((a) => a.t);
    expect(al).toContain("Estrés alto + azúcares elevados");
  });

  it("deshidratación e hidratación leen d7_agua, que es la misma unidad que d1_16", () => {
    // Su mapeo del 2026-07-28: "Hidratacion -> enc.d7_agua, vasos de 200 ml, la misma unidad que
    // esperaba d1_16". Son VASOS contados, no un indice: sus cortes son `<= 3` y `>= 8`.
    const seco = alertasDisponibles(
      enc({ d7_agua: "2", d7_58: "Oscuro (naranja / marrón)" }),
    ).map((a) => a.t);
    expect(seco).toContain("Deshidratación probable");

    const bien = alertasDisponibles(enc({ d7_agua: "9" })).map((a) => a.t);
    expect(bien).toContain("Hidratación adecuada");
  });

  it("y sin el dato del agua NINGUNA de las dos se dispara, que es lo que estaba mal", () => {
    // ESTE ES EL DEFECTO QUE LA TRADUCCION CIERRA. Leyendo `d1_16` (inexistente), `agua` era siempre 0:
    // `agua <= 3` se cumplia SIEMPRE y "Deshidratación probable" salia por la orina oscura sola,
    // afirmandole al profesional "Agua: 0 vasos" sobre una pregunta que el paciente nunca respondio.
    const sinAgua = alertasDisponibles(enc({ d7_58: "Oscuro (naranja / marrón)" })).map((a) => a.t);
    expect(sinAgua).not.toContain("Deshidratación probable");
    expect(sinAgua).not.toContain("Hidratación adecuada");
  });

  it("un paciente sin banderas no genera ninguna alerta", () => {
    expect(alertasDisponibles(enc())).toEqual([]);
  });
});

describe("las diez de consumo se apagan solas, sin lista blanca", () => {
  it("ninguna aparece con los insumos nutricionales vacíos", () => {
    // Si alguna apareciera, seria que se esta evaluando el cuadro nutricional con ceros, que es peor que
    // no evaluarlo: un cero afirma "consume cero", no "no lo sabemos". Se apagan por la aritmetica
    // (`undefined > 3000` es false), no por una lista que alguien tenga que mantener al dia.
    const al = alertasDisponibles(
      enc({ d5_39: ["Diabetes tipo 2"], d6_43: ["Leche"], d3_23: "6", d1_13_i: "Todos los días" }),
    ).map((a) => a.t);
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

  it("los campos viejos ya no se leen crudos: el seed no tiene ninguno de los tres", () => {
    // La traduccion los rellena desde los vigentes. Si alguien creara `d1_14` en la encuesta, habria dos
    // fuentes del mismo dato y la traduccion pisaria una: por eso el candado mira tambien la CAPTURA.
    const seed = readFileSync("supabase/seed.ts", "utf8");
    for (const k of ["d1_14", "d1_15", "d1_16"]) {
      expect(seed.includes(`key: "${k}"`), `${k} no debería existir en la encuesta`).toBe(false);
    }
    // Y los vigentes de los que salen SI tienen que existir, o la traduccion queda apuntando al vacio.
    for (const k of ["d1_13_i", "d7_agua", "d7_58", "d2_21"]) {
      expect(seed.includes(`key: "${k}"`), `${k} debería existir en la encuesta`).toBe(true);
    }
  });
});

describe("un cero MEDIDO no es un cero ausente, tampoco aquí", () => {
  it("el paciente que responde 0 vasos SÍ dispara la deshidratación", () => {
    // Es la distincion entera, y la misma del punto 4 sobre el ISCM: lo que frena la regla es la
    // AUSENCIA del dato, no su valor. Si esto se rompiera habriamos cambiado "no inventes un dato" por
    // "ignora un dato valido", que en esta regla significa callar sobre un paciente deshidratado.
    const al = alertasDisponibles(
      enc({ d7_agua: "0", d7_58: "Oscuro (naranja / marrón)" }),
    ).map((a) => a.t);
    expect(al).toContain("Deshidratación probable");
  });

  it("y el texto que lee el profesional cita el número que el paciente respondió", () => {
    // El defecto original no era que la regla se disparara: era que AFIRMABA "Agua: 0 vasos" sin que
    // nadie hubiera respondido 0. Ahora el numero del texto sale del dato.
    const al = alertasDisponibles(enc({ d7_agua: "2", d7_58: "Oscuro (naranja / marrón)" }));
    expect(al.find((a) => a.t === "Deshidratación probable")?.txt).toContain("Agua: 2 vasos");
  });
});
