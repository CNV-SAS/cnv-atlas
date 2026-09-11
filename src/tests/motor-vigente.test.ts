import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ENGINE_VERSION, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";
import { AUTHORIZED_MODIFICATIONS } from "@/clinical-engine/frozen/authorized-modifications.js";
import {
  cortesVigentes,
  modificacionesVigentes,
  motorVigente,
} from "@/modules/model-registry/motor-vigente";

// ═══ CANDADO DEL TALLER DEL MODELO (2026-09-10) ═══
//
// LA PANTALLA EXISTE PORQUE nadie podia responder desde Atlas con que version del motor se esta
// diagnosticando. Una pantalla que contesta esa pregunta con un texto escrito a mano es PEOR que no
// tenerla: un texto que afirma un estado sin derivarlo miente el dia que el estado cambia, y aqui lo que
// mentiria es con que ciencia se calculo un diagnostico.
//
// Por eso todo lo que muestra se DERIVA, y esto lo comprueba.

describe("el taller dice la version que CORRE, no una escrita a mano", () => {
  it("las dos versiones salen del motor", () => {
    const m = motorVigente();
    expect(m.engineVersion).toBe(ENGINE_VERSION);
    expect(m.protocolVersion).toBe(PROTOCOL_ENGINE_VERSION);
  });

  it("y ninguna version esta escrita como literal en los componentes", () => {
    // Si alguien pega el numero en el JSX, la pantalla sigue viendose bien el dia que la version suba y
    // afirmara la version anterior. Es el defecto exacto contra el que existe esta pantalla.
    for (const archivo of [
      "src/modules/model-registry/components/motor-hoy.tsx",
      "src/modules/model-registry/components/cortes-vigentes.tsx",
    ]) {
      const src = readFileSync(archivo, "utf8");
      // Se mira el JSX, no los comentarios: un comentario que cita una version es historia, no afirmacion.
      const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(sinComentarios, `${archivo} escribe una version a mano`).not.toMatch(/\d+\.\d+\.\d+/);
    }
  });

  it("hay una explicacion escrita para la version que corre HOY", () => {
    // ESTE ES EL CASO QUE SE PONE ROJO AL SUBIR LA VERSION, y es el que hace que la pantalla no pueda
    // quedarse atras: el numero se deriva solo, pero la frase que dice QUE SIGNIFICA hay que escribirla.
    // Sin este candado, el dia del bump la pantalla mostraria la version nueva con la explicacion vieja
    // o sin ninguna, y las dos cosas son peores que no decir nada.
    const m = motorVigente();
    expect(
      m.queEs,
      `falta la explicación de la versión ${ENGINE_VERSION} en QUE_ES_ESTA_VERSION (motor-vigente.ts)`,
    ).not.toBe("");
  });

  it("la marca de calibracion provisional se deriva del sello, no de una constante suelta", () => {
    const m = motorVigente();
    expect(m.calibracionProvisional).toBe(m.calibracion.endsWith("-provisional"));
  });
});

describe("las modificaciones autorizadas se agrupan por INSTRUCCION, no por trozo", () => {
  // Su mecanismo exige una entrada por TROZO de texto sustituido (cada `oldSlice` aparece exactamente una
  // vez y no pueden solaparse), asi que UNA instruccion suya puede ser quince entradas. Listarlas sueltas
  // daria a entender quince decisiones distintas.
  const vigentes = modificacionesVigentes();

  it("no se pierde ninguna: los trozos suman el total del manifiesto", () => {
    const total = vigentes.reduce((n, m) => n + m.trozos, 0);
    expect(total).toBe(AUTHORIZED_MODIFICATIONS.length);
  });

  it("los caId de un mismo grupo colapsan en uno (CA-6a..CA-6o -> CA-6)", () => {
    const ca6 = vigentes.find((m) => m.caId === "CA-6");
    expect(ca6, "desapareció la autorización del dominio sin dato").toBeDefined();
    expect(ca6!.trozos).toBeGreaterThan(1);
    expect(vigentes.filter((m) => m.caId.startsWith("CA-6"))).toHaveLength(1);
  });

  it("cada una lleva su fecha y su instruccion: sin eso la lista no explica nada", () => {
    for (const m of vigentes) {
      expect(m.fecha, `${m.caId} sin fecha`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.instruccion.length, `${m.caId} sin instrucción`).toBeGreaterThan(20);
    }
  });

  it("van en orden cronologico", () => {
    const fechas = vigentes.map((m) => m.fecha);
    expect([...fechas].sort()).toEqual(fechas);
  });
});

describe("los cortes salen de las fuentes que ya tienen candado", () => {
  const cortes = cortesVigentes();

  it("estan los doce indicadores ANI", () => {
    expect(cortes).toHaveLength(12);
  });

  it("ninguna fila se queda sin nada que decir", () => {
    // Una fila con las cuatro celdas vacias seria ruido: ocupa sitio y no responde la pregunta por la que
    // se abre esta tabla.
    for (const c of cortes) {
      const algo = c.referenciaH ?? c.bandasH;
      expect(algo, `${c.codigo} no trae ni referencia ni bandas`).toBeTruthy();
    }
  });

  it("no hay numeros escritos a mano en el modulo: salen de indicatorBands e INDICES_ANI", () => {
    // Dos fuentes NUESTRAS del mismo corte sin nada que las compare es como se llega a que la pantalla y
    // la historia clinica citen umbrales distintos. Ya paso con el IRC (ver hc-indices-ani.test.ts).
    const src = readFileSync("src/modules/model-registry/motor-vigente.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/[<>≤≥]\s*\d+[.,]\d+/);
  });

  it("los cuatro que no salen en su HC SI traen referencia", () => {
    // FMI, FFMI, AF e IR no tienen fila en el bloque ANI-BIS-E de su historia clinica, asi que su
    // referencia se lee de `indicatorRange` con una sonda. Si ese camino se rompe, estas cuatro filas se
    // quedarian en blanco sin que nada mas fallara.
    for (const codigo of ["FMI", "FFMI", "AF", "IR"]) {
      const c = cortes.find((x) => x.codigo === codigo)!;
      expect(c.referenciaH, `${codigo} sin referencia (hombre)`).toBeTruthy();
      expect(c.referenciaM, `${codigo} sin referencia (mujer)`).toBeTruthy();
    }
  });

  it("la sonda solo aporta la REFERENCIA: su valor inventado no llega a la pantalla", () => {
    // La sonda le pasa un valor cualquiera a `indicatorRange` porque la funcion exige uno para devolver
    // algo. Lo que se lee es `reference`, que depende solo del sexo. La Δ SI depende del valor, y una Δ
    // calculada contra un valor inventado en una pantalla de referencia seria una cifra falsa.
    const tipo = cortes[0];
    expect(Object.keys(tipo).sort()).toEqual(
      ["bandasH", "bandasM", "codigo", "nombre", "referenciaH", "referenciaM"],
    );
  });

  it("el PABU y el ICA-BIS no traen bandas, y eso es correcto", () => {
    // Son referencia de PUNTO (φ y la coherencia 0), no de banda. La pantalla lo DICE en la celda en vez
    // de dejarla vacia: una celda vacia se lee como dato que falta.
    expect(cortes.find((c) => c.codigo === "PABU")!.bandasH).toBeNull();
    expect(cortes.find((c) => c.codigo === "ICA-BIS")!.bandasH).toBeNull();
  });
});

describe("lo que el taller NO muestra, y es deliberado", () => {
  // SIN COMENTARIOS, y por la razon de siempre: un candado que busca una cadena prohibida se CAZA A SI
  // MISMO en cuanto el codigo explica por que esa cadena no debe estar. Paso al escribir este archivo: el
  // comentario que dice "no enseña los SHA de PROTOCOL_ARTIFACTS_SHA" ponia rojo al caso que lo prohibe.
  // Un comentario que NOMBRA algo no lo afirma; el codigo si.
  const sinComentarios = (f: string) =>
    readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  const motorVigenteSrc = sinComentarios("src/modules/model-registry/motor-vigente.ts");
  const componentes = [
    "src/modules/model-registry/components/motor-hoy.tsx",
    "src/modules/model-registry/components/cortes-vigentes.tsx",
  ].map(sinComentarios);

  it("los SHA de los artefactos NO llegan a la pantalla", () => {
    // Santiago, aprobando el plan: "bien las tres cosas que dejas fuera, sobre todo no poner el SHA: es un
    // candado de test, no informacion para un profesional". `PROTOCOL_ARTIFACTS_SHA` existe para que un
    // cambio en los artefactos obligue a DECIDIR si sube la version; no dice nada de lo clinico.
    expect(motorVigenteSrc).not.toContain("PROTOCOL_ARTIFACTS_SHA");
    for (const src of componentes) expect(src).not.toContain("PROTOCOL_ARTIFACTS_SHA");
  });

  it("no hay forma de CAMBIAR nada desde aqui: ni acciones ni formularios", () => {
    // Una version del motor no se toca desde una pantalla. Y estos dos componentes son de servidor: si
    // alguien les mete una server action, ademas pasan a ser otra cosa.
    for (const src of componentes) {
      expect(src).not.toContain("Action");
      expect(src).not.toContain("<form");
      expect(src).not.toContain("use client");
    }
  });

  it("el modulo es NEUTRO: ni server-only ni cliente", () => {
    // Lo importan una page de servidor y (el dia que haga falta) cualquier otro lado. Un `server-only` o
    // un "use client" aqui es la arista que ya tumbo dos rutas en produccion.
    expect(motorVigenteSrc).not.toContain("server-only");
    expect(motorVigenteSrc).not.toContain('"use client"');
  });
});
