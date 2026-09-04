import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { dfiParaPaciente, type EngineOutput } from "@/clinical-engine";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

// CANDADO DEL DFI EN LENGUAJE DE PACIENTE. Porte del mapa de Gildardo (`_dfiPac`, v8).
//
// POR QUE SE PORTA Y NO SE ESCRIBE: es una decisión clínica suya sobre cómo se le habla a una persona de
// su propio estado, no una simplificación de presentación. Su comentario junto al bloque: "versión amable
// y segura... sin CRÍTICO alarmante, sin mencionar TCA". Escribir nosotros ese lenguaje sería inventar
// contenido clínico, que es lo que la Regla 0 prohíbe.
//
// Y ES EL LADO OPUESTO de `dfi-narrative`, que es la narrativa del PROFESIONAL: dos lenguajes para el
// mismo dato, que no se mezclan.

const FUENTE = readFileSync("src/clinical-engine/dfi-paciente.ts", "utf8");

/** Un DFI mínimo con los campos que el traductor lee. El resto del snapshot no le importa. */
function snap(
  nivel: string,
  domains: { id: string; nombre: string; sev: number | null; lectura: string }[],
  veto = false,
): EngineOutput {
  return {
    dfi: {
      riesgo: { nivel, score: 7, descripcion: "descripción del modelo" },
      domains,
      veto,
      rutas: [],
      complete: true,
    },
  } as unknown as EngineOutput;
}

const D = (id: string, sev: number | null, lectura = "lectura técnica") => ({
  id,
  nombre: id.toUpperCase(),
  sev,
  lectura,
});

describe("los cuatro niveles de riesgo, en sus palabras", () => {
  it.each([
    ["BAJO", "Óptimo"],
    ["MEDIO", "A mejorar"],
    ["ALTO", "Requiere atención"],
    ["CRÍTICO", "Prioritario"],
  ])("%s se le dice al paciente %s", (modelo, paciente) => {
    expect(dfiParaPaciente(snap(modelo, []))?.riesgo).toBe(paciente);
  });

  it("y cada nivel trae SU frase de enfoque, no la descripción del modelo", () => {
    // `_ENFOQUE` es parte del mapa: dice qué hacer, en segunda persona. La descripción del modelo
    // ("Intervención activa priorizada") es lenguaje de historia clínica.
    const r = dfiParaPaciente(snap("ALTO", []));
    expect(r?.enfoque).toBe(
      "Es importante trabajar de forma activa con tu profesional en los próximos meses.",
    );
    expect(r?.enfoque).not.toContain("Intervención");
  });
});

describe("las severidades por dominio", () => {
  it.each([
    [0, "En equilibrio"],
    [1, "A vigilar"],
    [2, "A trabajar"],
    [3, "Prioritario"],
  ])("severidad %s se le dice %s", (sev, etiqueta) => {
    const r = dfiParaPaciente(snap("BAJO", [D("d1", sev as number)]));
    expect(r?.dominios[0].nivel).toBe(etiqueta);
  });

  it("un dominio SIN DATO no recibe etiqueta, en vez de una inventada", () => {
    // Su mapa espera un índice de 0 a 3 y es ANTERIOR a su punto 4 del 2026-08-30 (un dominio sin dato no
    // puntúa), así que no cubre el null. Añadirle una quinta etiqueta sería agregarle un nivel a su
    // escala. La lectura que el motor produce ya dice que no se evaluó.
    const r = dfiParaPaciente(snap("BAJO", [D("d3", null, "su ritmo de envejecimiento no se evaluó")]));
    expect(r?.dominios[0].nivel).toBeNull();
    expect(r?.dominios[0].lectura).toContain("no se evaluó");
  });
});

describe("lo más delicado del mapa: el dominio conductual y el veto", () => {
  it("con severidad alta, la lectura técnica del conductual se REEMPLAZA", () => {
    // Es la razón por la que este mapa no se podía escribir de memoria: la lectura técnica de ese dominio
    // puede nombrar conductas de riesgo alimentario, y él decidió que al paciente no se le dice eso.
    const r = dfiParaPaciente(snap("ALTO", [D("d4", 3, "conductas compensatorias: vómito, laxantes")]));
    expect(r?.dominios[0].lectura).toBe(
      "Te acompañaremos de cerca en tu relación con la alimentación y la imagen corporal; tu bienestar emocional es la prioridad.",
    );
    expect(r?.dominios[0].lectura).not.toContain("vómito");
  });

  it("con severidad baja NO se reemplaza: la regla es suya y tiene umbral", () => {
    const r = dfiParaPaciente(snap("BAJO", [D("d4", 1, "lectura normal del conductual")]));
    expect(r?.dominios[0].lectura).toBe("lectura normal del conductual");
  });

  it("y con severidad NULA tampoco: sin dato no hay umbral que cruzar", () => {
    // El borde que su código no tenía que considerar y el nuestro sí: `null >= 2` es falso en JS, así que
    // habría acertado por casualidad. Aquí es por criterio, y por eso está escrito.
    const r = dfiParaPaciente(snap("BAJO", [D("d4", null, "el dominio conductual no se evaluó")]));
    expect(r?.dominios[0].lectura).toContain("no se evaluó");
  });

  it("el veto se reformula como acompañamiento, no como advertencia", () => {
    expect(dfiParaPaciente(snap("CRÍTICO", [], true))?.acompanamiento).toBe(
      "Tu profesional te acompañará de cerca; priorizaremos tu bienestar emocional antes que cualquier cambio en la alimentación.",
    );
    expect(dfiParaPaciente(snap("CRÍTICO", [], false))?.acompanamiento).toBeNull();
  });
});

describe("su regla para lo que el mapa no traduce", () => {
  it("un nivel desconocido se deja COMO ESTÁ, no se rellena", () => {
    // `_NIVPAC[nivel] || nivel`, portado. No inventar es también no tocar.
    const r = dfiParaPaciente(snap("NIVEL_QUE_NO_EXISTE", []));
    expect(r?.riesgo).toBe("NIVEL_QUE_NO_EXISTE");
    expect(r?.enfoque).toBe("descripción del modelo");
  });
});

describe("lo que NO viaja, y es deliberado", () => {
  it("el índice numérico de riesgo no está en la salida", () => {
    // Su `informePaciente` SÍ lo incluye (`indice: dfi.riesgo.score`), pero su §7.1 dice que ningún índice
    // del modelo va al paciente. Entre su instrucción y su implementación mandan sus palabras.
    const r = dfiParaPaciente(snap("ALTO", [D("d1", 2)]));
    expect(JSON.stringify(r)).not.toContain("7");
    expect(FUENTE).toContain("EL INDICE NUMERICO NO SALE");
  });

  it("ni el color ni el nivel de zona: son de la presentación de su app", () => {
    const r = dfiParaPaciente(snap("ALTO", [D("d1", 2)]));
    expect(Object.keys(r?.dominios[0] ?? {})).toEqual(["id", "dominio", "nivel", "lectura"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// LA PARIDAD CON SU ARCHIVO, que hasta el 2026-09-04 NADIE VIGILABA.
//
// COMO SALIO: barriendo los candados que afirman una relacion con otro artefacto y leen uno solo (la
// forma del defecto de `plan-imprimible.test.ts`). Este archivo decia en su cabecera "PORTE del mapa de
// Gildardo (`_dfiPac`, v8)" y todo lo de arriba prueba el COMPORTAMIENTO de nuestra funcion: que las
// etiquetas salgan, que un dominio sin dato no reciba una inventada, que la lectura del conductual se
// reemplace con severidad alta. Nada abria su archivo.
//
// Y NO ESTABA CUBIERTO POR OTRO LADO: `frozen-deriva-vigente` barre `clinical-engine/frozen/*`, y
// `dfi-paciente.ts` no vive ahi porque no es un modulo congelado suyo, es un porte nuestro de su mapa.
// Se cayo justo por la rendija entre los dos.
//
// POR QUE IMPORTA MAS QUE OTROS: estas catorce frases son EL LENGUAJE CON EL QUE SE LE DICE A UNA PERSONA
// COMO ESTA, y van en el documento que recibe. Es contenido que el mismo pidio no escribir nosotros. Si
// cambia una y no nos enteramos, Atlas le sigue diciendo al paciente lo que el ya corrigio.
//
// AL CERRARLO SE VERIFICO EL ESTADO DE HOY: las catorce coinciden con su entrega vigente. O sea que la
// garantia no existia y ademas acertaba, que es la unica combinacion que no deja rastro.

const SUYO = (() => {
  const html = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
  const i = html.indexOf("const _dfiPac = (function(){");
  if (i < 0) throw new Error("no encuentro `_dfiPac` en su entrega vigente");
  return html.slice(i, html.indexOf("})();", i));
})();

/** Los valores de un objeto literal suyo (`_NIVPAC={ "BAJO":"Óptimo", ... }`). */
const valoresDeMapa = (nombre: string): string[] => {
  const m = new RegExp(`${nombre}\\s*=\\s*\\{([^}]*)\\}`).exec(SUYO);
  return m ? [...m[1].matchAll(/"[^"]*"\s*:\s*"([^"]*)"/g)].map((x) => x[1]) : [];
};
/** Los valores de un array literal suyo (`_SEVPAC=["En equilibrio", ...]`). */
const valoresDeLista = (nombre: string): string[] => {
  const m = new RegExp(`${nombre}\\s*=\\s*\\[([^\\]]*)\\]`).exec(SUYO);
  return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : [];
};

const PORT = readFileSync("src/clinical-engine/dfi-paciente.ts", "utf8");

describe("las frases son VERBATIM de su entrega vigente, no una redacción nuestra", () => {
  it("CONTROL: la extracción encuentra su bloque y sus cinco piezas", () => {
    // Sin esto, todo lo de abajo pasaría verde el día que su archivo cambie de forma y la extracción
    // devuelva listas vacías: comparar cero frases contra cero frases siempre coincide.
    expect(SUYO.length, "el bloque `_dfiPac` salió vacío").toBeGreaterThan(500);
    expect(valoresDeMapa("_NIVPAC")).toHaveLength(4);
    expect(valoresDeMapa("_ENFOQUE")).toHaveLength(4);
    expect(valoresDeLista("_SEVPAC")).toHaveLength(4);
    expect(SUYO).toContain('d.id==="d4" && d.sev>=2');
    expect(SUYO).toContain("acompanamiento: dfi.veto ?");
  });

  it.each([
    ["_NIVPAC · el nivel de riesgo que lee el paciente", () => valoresDeMapa("_NIVPAC")],
    ["_ENFOQUE · la frase de enfoque por nivel", () => valoresDeMapa("_ENFOQUE")],
    ["_SEVPAC · la severidad de cada dominio", () => valoresDeLista("_SEVPAC")],
  ])("%s", (_n, saca) => {
    for (const frase of saca()) {
      expect(PORT, `esta frase suya no está en el port: ${JSON.stringify(frase)}`).toContain(frase);
    }
  });

  it("y las dos frases sueltas: el reemplazo del conductual y el acompañamiento del veto", () => {
    // Son las dos más delicadas: una habla de la relación con la comida y el cuerpo, la otra es la que
    // sustituye a un veto para que no llegue como advertencia.
    const d4 = /d\.id==="d4" && d\.sev>=2\) lectura="([^"]+)"/.exec(SUYO);
    const acom = /acompanamiento: dfi\.veto \? "([^"]+)"/.exec(SUYO);
    expect(d4?.[1], "no se pudo extraer el reemplazo del dominio conductual").toBeTruthy();
    expect(acom?.[1], "no se pudo extraer la frase del veto").toBeTruthy();
    expect(PORT).toContain(d4![1]);
    expect(PORT).toContain(acom![1]);
  });
});
