import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ENGINE_VERSION, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";
import { motorVigente } from "@/modules/model-registry/motor-vigente";

// ═══ CANDADO DE LA PANTALLA DEL MODELO (2026-09-10) ═══
//
// LA PANTALLA EXISTE PORQUE nadie podia responder desde Atlas con que version del motor se esta
// diagnosticando. Una pantalla que contesta esa pregunta con un texto escrito a mano es PEOR que no
// tenerla: un texto que afirma un estado sin derivarlo miente el dia que el estado cambia, y aqui lo que
// mentiria es con que ciencia se calculo un diagnostico.
//
// Por eso todo lo que muestra se DERIVA, y esto lo comprueba.

const REGISTRO = { modelo: "1.0.0", reglas: "1.0.0" };

describe("las cuatro versiones salen de su fuente, no de un texto", () => {
  it("motor y protocolo salen del codigo del motor", () => {
    const v = Object.fromEntries(motorVigente(REGISTRO).versiones.map((x) => [x.nombre, x.valor]));
    expect(v.Motor).toBe(ENGINE_VERSION);
    expect(v.Protocolo).toBe(PROTOCOL_ENGINE_VERSION);
  });

  it("modelo y reglas salen de la FILA de base de datos, no de una constante", () => {
    // Son las dos que NO viven en el codigo: si alguien las escribe aqui, la pantalla seguira diciendo
    // "1.0.0" el dia que se siembre una version nueva del registro.
    const v = Object.fromEntries(
      motorVigente({ modelo: "9.9.9", reglas: "8.8.8" }).versiones.map((x) => [x.nombre, x.valor]),
    );
    expect(v.Modelo).toBe("9.9.9");
    expect(v.Reglas).toBe("8.8.8");
  });

  it("sin registro sembrado lo DICE, no rellena con un numero plausible", () => {
    // Si el registro no esta, el diagnostico tampoco puede sellarse. Una pantalla que muestre un "1.0.0"
    // de cortesia haria creer lo contrario, que es peor que no mostrar nada.
    const m = motorVigente(null);
    expect(m.sinRegistro).toBe(true);
    const v = Object.fromEntries(m.versiones.map((x) => [x.nombre, x.valor]));
    expect(v.Modelo).toBe("sin registro");
    expect(v.Reglas).toBe("sin registro");
  });

  it("ninguna version esta escrita como literal en el componente", () => {
    // Si alguien pega el numero en el JSX, la pantalla sigue viendose bien el dia que la version suba y
    // afirmara la version anterior. Es el defecto exacto contra el que existe esta pantalla.
    const src = readFileSync("src/modules/model-registry/components/motor-hoy.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, "motor-hoy.tsx escribe una versión a mano").not.toMatch(/\d+\.\d+\.\d+/);
  });

  it("hay una explicacion escrita para la version que corre HOY", () => {
    // ESTE ES EL CASO QUE SE PONE ROJO AL SUBIR LA VERSION, y es el que hace que la pantalla no pueda
    // quedarse atras: el numero se deriva solo, pero la frase que dice QUE SIGNIFICA hay que escribirla.
    // Sin este candado, el dia del bump la pantalla mostraria la version nueva con la explicacion vieja
    // o sin ninguna, y las dos cosas son peores que no decir nada.
    const m = motorVigente(REGISTRO);
    expect(
      m.queEs,
      `falta la explicación de la versión ${ENGINE_VERSION} en QUE_ES_ESTA_VERSION (motor-vigente.ts)`,
    ).not.toBe("");
    expect(m.desde, `falta la fecha de la versión ${ENGINE_VERSION}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("la marca de calibracion provisional se deriva del sello, no de una constante suelta", () => {
    const m = motorVigente(REGISTRO);
    expect(m.calibracionProvisional).toBe(m.calibracion.endsWith("-provisional"));
  });
});

// ═══ UN SOLO JUEGO DE NOMBRES EN LAS DOS SUPERFICIES (Santiago, 2026-09-10) ═══
//
// SU REPORTE: el pie del diagnostico decia "Motor · modelo · reglas" y esta pantalla decia "Modelo
// ANI-BIS-E · Protocolo de tratamiento". Dos juegos de nombres para cosas que se solapan, y quien los vea
// va a preguntar cual es cual.
//
// LO QUE SE VERIFICO antes de proponer nombres: son CUATRO, no tres, y ninguna es copia de otra (motor =
// la matematica; modelo = el catalogo de referencia; reglas = las reglas diagnosticas; protocolo = la
// cadena de prescripcion). Modelo y reglas salen de la MISMA fila y hoy nunca han divergido, pero se
// sellan por separado en cada diagnostico, asi que retirar una dejaria diagnosticos que no se pueden
// describir enteros.
describe("los nombres de las versiones son los mismos en las dos superficies", () => {
  const NOMBRES = ["Motor", "Modelo", "Reglas", "Protocolo"];

  it("la pantalla del modelo declara los cuatro, y cada uno dice que gobierna", () => {
    const vs = motorVigente(REGISTRO).versiones;
    expect(vs.map((v) => v.nombre)).toEqual(NOMBRES);
    // Cuatro numeros iguales sin explicacion se leen como cuatro copias del mismo dato.
    for (const v of vs) expect(v.gobierna.length, `${v.nombre} sin explicación`).toBeGreaterThan(20);
  });

  it("y el pie del diagnostico usa esas mismas palabras", () => {
    // SI ALGUIEN RENOMBRA UNA DE LAS DOS SUPERFICIES, esto se pone rojo. Es el unico modo de que no
    // vuelvan a separarse: las dos cadenas viven en archivos distintos y nada mas las relaciona.
    const pie = readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8");
    const linea = pie.slice(pie.indexOf("versions.engine") - 200, pie.indexOf("versions.rules") + 40);
    for (const n of ["Motor", "Modelo", "Reglas"]) {
      expect(linea, `el pie del diagnóstico ya no dice "${n}"`).toContain(n);
    }
    // EL PROTOCOLO NO VA EN ESE PIE, y es deliberado: ese pie traza lo que se sello en ESE diagnostico, y
    // el protocolo se sella en el TRATAMIENTO. Ponerlo afirmaria que el diagnostico se calculo con el.
    expect(linea).not.toContain("Protocolo");
  });
});

describe("lo que la pantalla NO muestra, y es deliberado", () => {
  // SIN COMENTARIOS, y por la razon de siempre: un candado que busca una cadena prohibida se CAZA A SI
  // MISMO en cuanto el codigo explica por que esa cadena no debe estar. Un comentario que NOMBRA algo no
  // lo afirma; el codigo si.
  const sinComentarios = (f: string) =>
    readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  const modulo = sinComentarios("src/modules/model-registry/motor-vigente.ts");
  const componentes = [
    "src/modules/model-registry/components/motor-hoy.tsx",
    "src/modules/model-registry/components/consentimiento-vigente.tsx",
  ].map(sinComentarios);

  it("los SHA de los artefactos NO llegan a la pantalla", () => {
    // Santiago: "sobre todo no poner el SHA: es un candado de test, no informacion para un profesional".
    // `PROTOCOL_ARTIFACTS_SHA` existe para que un cambio en los artefactos obligue a DECIDIR si sube la
    // version; no dice nada de lo clinico.
    expect(modulo).not.toContain("PROTOCOL_ARTIFACTS_SHA");
    for (const src of componentes) expect(src).not.toContain("PROTOCOL_ARTIFACTS_SHA");
  });

  it("no hay forma de CAMBIAR nada desde aqui: ni acciones ni formularios", () => {
    // Una version del motor no se toca desde una pantalla, y el consentimiento vigente es solo lectura.
    for (const src of componentes) {
      expect(src).not.toContain("Action");
      expect(src).not.toContain("<form");
      expect(src).not.toContain("use client");
    }
  });

  it("el modulo de versiones es NEUTRO: ni server-only ni cliente", () => {
    // Lo importa un componente de servidor y lo puede importar cualquier otro lado. Un `server-only` o un
    // "use client" aqui es la arista que ya tumbo dos rutas en produccion.
    expect(modulo).not.toContain("server-only");
    expect(modulo).not.toContain('"use client"');
  });
});

// ═══ LO QUE SE RETIRO DE /ani-bis-e TIENE SITIO, Y ESTO LO COMPRUEBA (2026-09-10) ═══
//
// Se retiraron tres colas de lote. Cada una se verifico contra su camino por evaluacion ANTES de quitarla,
// y esto impide que ese camino desaparezca despues dejando la funcion sin ninguna puerta. Es el defecto
// que este proyecto repite al reves: una pieza construida a la que nadie llama. Aqui seria una pieza
// retirada cuyo sustituto se cae.
describe("retirar las colas de lote no dejo nada sin camino", () => {
  it("importar BIS sigue estando en cada evaluacion, con sus guardas", () => {
    const entrada = readFileSync("src/modules/evaluations/components/entrada-evaluacion.tsx", "utf8");
    expect(entrada).toContain("BisImportForm");
    // Y con las DOS guardas que la cola no tenia, que es lo que hace mejor al camino por evaluacion.
    expect(entrada).toContain("contraindicated");
    expect(entrada).toContain("modoReemplazo");
  });

  it("generar diagnostico sigue estando en la evaluacion", () => {
    const pagina = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
    expect(pagina).toContain("GenerateDiagnosisPanel");
  });

  it("las encuestas sin responder las dice la columna de pendientes", () => {
    const pendientes = readFileSync("src/modules/patients/pendientes.ts", "utf8");
    expect(pendientes).toContain("Esperando al paciente");
  });

  it("y la pantalla del modelo ya no monta ninguna cola", () => {
    const pagina = readFileSync("src/app/(app)/ani-bis-e/page.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const cola of ["BisImportForm", "PipelineRunner", "AwaitingSurveyList"]) {
      expect(pagina, `la pantalla del modelo volvió a montar ${cola}`).not.toContain(cola);
    }
  });
});
