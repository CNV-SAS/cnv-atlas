import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

vi.mock("server-only", () => ({}));

import { ClinicalInputError } from "@/clinical-engine";
import { assertEngineInputs } from "@/clinical-engine/analysis";
import { mensajeDelInsumoClinico } from "@/modules/bis-intake/services/import-gate";

// ═══ UN DATO QUE EL MOTOR RECHAZA NO ES UN FALLO DEL SISTEMA (Sentry, 2026-10-02) ═══
//
// LO QUE PASO: una medicion con `C=16.22` (el rango fisiologico es 0,3 a 8 nF) hizo que `runEngine` LANZARA
// `ClinicalInputError`. Esa llamada estaba fuera de todo `try`, asi que la excepcion salia de la server action:
// la peticion moria con un 500, el render de los Server Components se caia, y la pantalla quedaba rota hasta que
// el profesional navegaba a otro sitio.
//
// 19 EVENTOS EN SENTRY, y eso es lo que convierte un defecto en un problema: alguien lo intento diecinueve
// veces porque lo unico que veia era que no pasaba nada. Un rechazo sin explicacion se vive como una pantalla
// colgada, no como una respuesta.
//
// EL FRENO ES CORRECTO Y NO SE TOCA. Ese valor no es fisiologico y no debe entrar al motor, y el rango es de
// Gildardo (congelado). Lo que se arregla es la FORMA del rechazo: una frase que dice que pasa y que hacer.
//
// LA REGLA NO SE REPITE, SE TRADUCE EL GRITO. La tentacion era agregar una cuarta puerta en el pipeline que
// mirara los rangos antes. Seria la misma regla escrita dos veces, capaz de divergir del motor, que es el
// defecto que nos ocupo el mes. El motor sigue siendo el unico que decide los rangos.

describe("el motor rechaza el dato, y sigue siendo el unico que lo decide", () => {
  const BASE = { Re: 600, Ri: 1300, Rinf: 450, C: 2, FM: 20, FFM: 55, FFMI: 18, peso: 75, talla: 170, FMI: 7 };

  it("un valor fuera de rango LANZA ClinicalInputError con su codigo", () => {
    // EL CASO REAL, con su cifra: si el rango cambiara, este caso lo diria en vez de pasar en silencio.
    let capturado: unknown;
    try {
      assertEngineInputs({ ...BASE, C: 16.22, raw: {} } as never);
    } catch (e) {
      capturado = e;
    }
    expect(capturado).toBeInstanceOf(ClinicalInputError);
    expect((capturado as ClinicalInputError).code).toBe("INSUMOS_FUERA_DE_RANGO");
    expect((capturado as Error).message).toContain("C=16.22");
  });

  it("y un valor normal no lanza (el control: sin esto, un guard roto 'pasaria' siempre)", () => {
    expect(() => assertEngineInputs({ ...BASE, raw: {} } as never)).not.toThrow();
  });
});

describe("el rechazo llega como una frase con salida, no como un 500", () => {
  const err = (code: string, message: string) => ({ code, message });

  it("el fuera de rango dice que hacer, y conserva el detalle tecnico", () => {
    const m = mensajeDelInsumoClinico(
      err("INSUMOS_FUERA_DE_RANGO", "Valores fuera de rango fisiológico: C=16.22 (rango 0.3–8)."),
    );
    // EL DETALLE SE CONSERVA: es lo que el profesional le reenvia a CNV para que alguien mire el equipo.
    // Quitarlo por hacerlo amable dejaria el aviso sin nada accionable.
    expect(m).toContain("C=16.22");
    // Y LA SALIDA, que es lo que faltaba y por lo que lo intentaron 19 veces.
    expect(m).toContain("Biody Manager");
    // ═══ Y EL SEGUNDO PASO NO MANDA A REPETIR LA TOMA (Santiago, 2026-10-02) ═══
    //
    // Repetir la medicion cuesta una CITA del paciente, y confirmaria algo que puede no ser suyo: los rangos
    // de Atlas se eligieron a ojo y el primero que disparo esta en consulta con Gildardo. Si el valor
    // sobrevive a un export limpio, lo que falta saber es si el limite esta bien.
    expect(m, "volvio a mandar a repetir la toma antes de preguntar por el limite").not.toMatch(
      /repite la toma(?! todavía)/,
    );
    expect(m).toContain("avísale a CNV");
    expect(m).toContain("puede ser el límite y no la medición");
    // Y NO AFIRMA UNA CERTEZA QUE NO TENEMOS: el rango es nuestro y todavia sin fuente, asi que el valor esta
    // fuera de lo que ATLAS admite, no fuera de lo posible en una persona.
    expect(m, "afirma como imposible un valor que solo esta fuera de un rango nuestro").not.toContain(
      "no es posible en una persona",
    );
    // Y lo que NO se puede hacer, dicho, para que nadie lo busque: es un resultado del equipo.
    expect(m.toLowerCase()).toContain("no se puede corregir a mano");
  });

  it("y en una consulta importada la salida es OTRA, porque no se puede re-exportar", () => {
    const m = mensajeDelInsumoClinico(
      err("INSUMOS_FUERA_DE_RANGO", "Valores fuera de rango fisiológico: C=16.22 (rango 0.3–8)."),
      true,
    );
    expect(m).toContain("se importó del HTML");
    expect(m, "le ofrece re-exportar algo que no se puede re-exportar").not.toContain("Vuelve a exportar");
  });

  it("un codigo desconocido no inventa una salida: dice lo del motor y pide avisar", () => {
    // Lo contrario seria lo peligroso: una frase amable que sugiere un remedio equivocado para un caso que
    // nadie previo.
    const m = mensajeDelInsumoClinico(err("ALGO_NUEVO", "Pasó algo que no conocemos."));
    expect(m).toContain("Pasó algo que no conocemos.");
    expect(m).toContain("Avísale a CNV");
  });
});

describe("y el pipeline lo atrapa, que es lo que impide el 500", () => {
  const PIPELINE = sinComentarios(
    readFileSync("src/modules/clinical-pipeline/services/run-pipeline.ts", "utf8"),
  );

  it("la llamada al motor va dentro de un try que distingue el rechazo del fallo", () => {
    // SE MIRA LA ESTRUCTURA porque es lo que no se puede perder: `runEngine` fuera del try vuelve a ser un 500,
    // y eso no lo nota ningun test de comportamiento que no provoque el error exacto.
    const i = PIPELINE.indexOf("runEngine(engineInput)");
    expect(i, "ya no se llama a runEngine aqui: revisa este candado").toBeGreaterThan(0);
    const antes = PIPELINE.slice(Math.max(0, i - 300), i);
    expect(antes, "la llamada al motor volvio a quedar fuera de un try: un dato malo tumba la pantalla").toContain(
      "try {",
    );
    const despues = PIPELINE.slice(i, i + 400);
    expect(despues).toContain("ClinicalInputError");
    expect(despues, "el rechazo tiene que volver como validacion, no como excepcion").toContain(
      "mensajeDelInsumoClinico",
    );
  });

  it("y lo inesperado SIGUE subiendo: no se traga cualquier error", () => {
    // Un catch que devolviera un mensaje para TODO convertiria un bug real en un aviso tranquilizador, que es
    // peor que el 500: nadie se entera.
    const i = PIPELINE.indexOf("runEngine(engineInput)");
    expect(PIPELINE.slice(i, i + 500)).toMatch(/throw e;/);
  });
});
