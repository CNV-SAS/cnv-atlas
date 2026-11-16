import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { alertasCriticas } from "@/clinical-engine/alertas-criticas";
import { indicatorSeverities } from "@/clinical-engine/severity";
import type { EngineIndicators, EngineOutput } from "@/clinical-engine/types";
import { clasificarIcaBis, rotuloDisplayDeIndice } from "@/modules/diagnoses/data/indicator-ranges";
import { componerHistoriaClinica, type HcEntradas } from "@/modules/reports/data/hc-composicion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EN UNA MISMA CONSULTA, LA HC DICE LO MISMO QUE EL DFI Y QUE LAS ALERTAS  ·  2026-11-16
//
// ═══ EL DEFECTO QUE CIERRA, REPORTADO POR SANTIAGO SOBRE UNA CONSULTA YA REEMITIDA A 4.0.0 ═══
//
// El diagnostico estaba bien y la tabla "Indices ANI-BIS-E alterados" de la historia clinica no, en
// CUATRO sitios a la vez y por DOS causas distintas:
//
//   · FALTABAN FILAS. El IFC 1,89 ("Disfunción celular") y el ICA-BIS (que el diagnostico marcaba como
//     ALERTA CRITICA, cola extrema por deficit) no aparecian en el documento probatorio.
//   · SOBRABA COLOR. El IRC 2,71 en una mujer salia con la severidad del corte MASCULINO.
//   · UN VEREDICTO FALSO. El IEHH −1,57 decia "Equilibrio hídrico óptimo" al lado de la referencia
//     "−1 a +1", de la que esta fuera (es la escalera de la v16; va en su propio candado,
//     `rotulos-display-de-su-archivo`).
//   · DOS NOMBRES PARA EL MISMO CRUCE: "Fenotipo MCCB: Normopeso" en la tabla de composicion y "S4 ·
//     Composición saludable" en el DFI.
//
// ═══ LA CAUSA DE LAS TRES PRIMERAS ERA UNA SOLA, Y ES LA QUE ESTE CANDADO VIGILA ═══
//
// `componerHistoriaClinica` recibia un snapshot RECORTADO (`{indicators, classifications}`) y llamaba a
// `indicatorSeverities(e.snapshot as never)`. Ese `as never` no era descuido: era la unica forma de
// satisfacer un parametro que pedia el `EngineOutput` entero, y con el entraba un `sexo` undefined sin
// que tsc dijera nada. **Desde la v17 eso no degrada: borra.** Sus clasificadores por sexo ya no caen a
// un corte global, devuelven "sin sexo: no se clasifica" en gris, el gris no tiene severidad, y la fila
// desaparece. El `cIRC` es la excepcion que lo hacia invisible: no usa `sexoBIS`, cae al corte masculino,
// asi que en una mujer no desaparecia, se pintaba de otro color.
//
// Medido en la nube el 2026-11-16 (`scripts/los-veredictos-de-la-hc-contra-el-dfi.mjs`): en **542 de las
// 552** consultas con informe sellado al menos una fila entraba o salia por la severidad equivocada.
//
// ═══ QUE PRUEBA ESTE ARCHIVO, Y POR QUE ASI ═══
//
// La regla que Santiago pidio: *"en una misma consulta, el veredicto de cada indice en la HC coincide
// con el del DFI y con las alertas criticas"*. Se prueba sobre el caso REAL que el reporto (sus cifras,
// que son variables clinicas, sin ningun dato de la paciente), y ademas sobre la FORMA, porque el
// defecto no vivia en un numero: vivia en un cast.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El sello de la consulta que Santiago reporto (mujer, reemitida a 4.0.0). Solo cifras del motor. */
const INDICADORES = {
  ifc: 1.89,
  irc: 2.71,
  iscm: -6.83,
  iehh: -1.57,
  eb: 76.4,
  iae: 12.4,
  pabu: 2.7,
  icaBis: 1.082,
  FFMI: 15.8,
  FMI: 7.2,
  AF: 4.1,
  IR: 0.81,
} as unknown as EngineIndicators;

/** Lo que el motor SELLO para esos valores, con los clasificadores de la v17. */
const CLASIFICACIONES: Record<string, { label: string } | null> = {
  IFC: { label: "Disfunción celular" },
  IRC: { label: "Riesgo moderado" },
  ISCM: { label: "< P10 de su sexo" },
  IEHH: { label: "Déficit" },
  IAE: { label: "Acelerado" },
  PABU: { label: "Alejamiento marcado por déficit" },
  // El sello guarda null en esta clave: la fila de la HC toma la del PABU (ATLAS_v8 L15425).
  "ICA-BIS": null,
};

const SNAPSHOT = {
  sexo: "F" as const,
  indicators: INDICADORES,
  classifications: CLASIFICACIONES,
};

/** Un `HcEntradas` con lo minimo: aqui solo se miran los indices, y lo demas no debe cambiar nada. */
function entradas(): HcEntradas {
  return {
    snapshot: {
      indicators: INDICADORES as unknown as Record<string, number | null> & { FFMI: number },
      classifications: CLASIFICACIONES as unknown as Record<string, unknown>,
      sexo: "F",
    },
    suggested: null,
    ajustes: { geb: null, pal: null, kcalObj: null, protGkg: null, fatPct: null, deficit: null, pesoMeta: null },
    protKgVigente: null,
    sexoM: false,
    sodioMax: null,
    protKg: null,
    protG: null,
    d5_39: null,
    flags: { tieneHTA: false, tieneIRC: false },
    deficitEstrategia: 0,
    pesoKg: null,
  };
}

/**
 * El veredicto que pinta la tabla de indices del Diagnostico para un codigo.
 *
 * La fila ICA-BIS se resuelve aparte, como en la pantalla: su clase sale de `clasificarIcaBis`, que
 * desde la v17 es `cPABU` con los percentiles del sexo. Y por eso coincide con la HC, que toma la
 * clasificacion SELLADA del PABU: las dos acaban en el mismo clasificador. Antes no: la pantalla
 * graduaba la magnitud con el porte de su `dICA`, que su v17 borro.
 */
function veredictoDelDfi(codigo: string, valor: number | null): string | null {
  if (codigo === "ICA-BIS") return clasificarIcaBis(INDICADORES.pabu, SNAPSHOT.sexo)?.l ?? null;
  const sello = CLASIFICACIONES[codigo]?.label ?? null;
  return rotuloDisplayDeIndice(codigo, valor, sello) ?? sello;
}

const VALOR: Record<string, number | null> = {
  IFC: INDICADORES.ifc,
  IRC: INDICADORES.irc,
  ISCM: INDICADORES.iscm,
  IEHH: INDICADORES.iehh,
  IAE: INDICADORES.iae,
  PABU: INDICADORES.pabu,
  "ICA-BIS": INDICADORES.icaBis,
};

describe("el caso que Santiago reportó: las filas que faltaban vuelven", () => {
  const indices = componerHistoriaClinica(entradas()).indices;
  const porCodigo = new Map(indices.map((i) => [i.codigo, i]));

  it("el IFC 1,89 está, y con la palabra de la pantalla", () => {
    // Era la fila que mas pesaba de las que faltaban: una disfuncion celular que el documento probatorio
    // no nombraba. Antes de la reemision SI aparecia, porque el `cIFC` de la v16 caia al corte global
    // 3,5/6,0 cuando no habia sexo; la v17 retiro esa caida y el defecto se volvio visible.
    expect(porCodigo.get("IFC")?.clasificacion).toBe("Disfunción celular establecida");
    expect(porCodigo.get("IFC")?.sev).toBe(3);
  });

  it("el ICA-BIS está, que es el que el diagnóstico marca como alerta crítica", () => {
    expect(porCodigo.has("ICA-BIS")).toBe(true);
    expect(porCodigo.get("ICA-BIS")?.clasificacion).toBe("Alejamiento marcado por déficit");
  });

  it("el IRC lleva la severidad de SU sexo, no la del corte masculino", () => {
    // 2,71 en una mujer es la banda central de `cIRC` (2,3 a 2,8): ambar, severidad 2. Con el corte
    // masculino (1,7 / 2,1) la MISMA cifra sale roja. El rotulo no cambiaba, asi que el defecto solo se
    // veia en el color: por eso hay que fijarlo con un numero.
    expect(porCodigo.get("IRC")?.sev).toBe(2);
  });

  it("el IEHH dice déficit, no equilibrio óptimo", () => {
    expect(porCodigo.get("IEHH")?.clasificacion).toBe("Déficit");
  });
});

describe("en una misma consulta, cada índice dice lo mismo en la HC y en el DFI", () => {
  const indices = componerHistoriaClinica(entradas()).indices;
  const sev = indicatorSeverities(SNAPSHOT as unknown as EngineOutput);

  it("el veredicto de cada fila de la HC es el que pinta la tabla del Diagnóstico", () => {
    for (const fila of indices) {
      expect(fila.clasificacion, `la HC y el DFI difieren en ${fila.codigo}`).toBe(
        veredictoDelDfi(fila.codigo, VALOR[fila.codigo] ?? null),
      );
    }
  });

  it("y la severidad de cada fila es la del motor con el sexo del sello", () => {
    for (const fila of indices) {
      // La fila ICA-BIS toma la del PABU, que es la regla de ESTA superficie, no una excepcion nuestra.
      const codigo = fila.codigo === "ICA-BIS" ? "PABU" : fila.codigo;
      expect(fila.sev, `la severidad de ${fila.codigo} no es la del motor`).toBe(sev[codigo]);
    }
  });

  it("la selección es exactamente la del motor: todo lo alterado, y nada más", () => {
    // Las dos direcciones. Que no falte ninguna (el defecto de hoy) y que no sobre ninguna (el defecto
    // contrario, que seria igual de malo en un documento que se llama "alterados").
    const esperadas = Object.keys(VALOR).filter((c) => {
      const codigo = c === "ICA-BIS" ? "PABU" : c;
      const etiqueta = CLASIFICACIONES[c]?.label ?? CLASIFICACIONES[codigo]?.label ?? null;
      return (sev[codigo] ?? 0) >= 1 && !!etiqueta && VALOR[c] != null;
    });
    expect([...indices.map((i) => i.codigo)].sort()).toEqual(esperadas.sort());
  });
});

describe("y lo que el diagnóstico marca como crítico, la HC lo lista", () => {
  const indices = componerHistoriaClinica(entradas()).indices;
  const codigos = new Set(indices.map((i) => i.codigo));

  const alertas = alertasCriticas({
    sexo: "F",
    ifc: INDICADORES.ifc,
    irc: INDICADORES.irc,
    pabu: INDICADORES.pabu,
    iae: INDICADORES.iae,
    ffmi: INDICADORES.FFMI,
    sectorId: null,
  });

  it("el control: este caso SÍ dispara alertas críticas", () => {
    // Sin esto, el bucle de abajo pasaria verde sobre una lista vacia, que es el modo en que un candado
    // de coherencia miente.
    expect(alertas.length).toBeGreaterThan(0);
  });

  it("cada índice nombrado en una alerta crítica aparece en la tabla de alterados", () => {
    // La relacion no es simetrica y no debe serlo: la HC lista TODO lo alterado, y las alertas son solo
    // la cola extrema. Lo que no puede pasar es lo contrario: que el diagnostico grite por un indice que
    // el documento probatorio no menciona. Eso es lo que pasaba con el ICA-BIS y con el IFC.
    for (const sigla of ["IFC", "IRC", "IAE", "ICA-BIS"]) {
      if (alertas.some((a) => a.includes(sigla))) {
        expect(codigos.has(sigla), `la alerta crítica nombra ${sigla} y la HC no lo lista`).toBe(true);
      }
    }
  });
});

describe("la forma: nadie vuelve a computar la severidad sin el sexo", () => {
  const COMPOSER = readFileSync("src/modules/reports/data/hc-composicion.ts", "utf8");
  const SEVERITY = readFileSync("src/clinical-engine/severity.ts", "utf8");

  it("`indicatorSeverities` pide solo lo que usa, para que el llamador incompleto no compile", () => {
    // Es el arreglo de fondo. Mientras el parametro pida el `EngineOutput` entero, un llamador con un
    // snapshot recortado solo puede satisfacerlo con un cast, y un cast apaga la unica alarma que habia.
    expect(SEVERITY).toContain('Pick<EngineOutput, "indicators" | "sexo">');
  });

  it("el composer de la HC le pasa el sexo del sello, y sin ningún `as never`", () => {
    expect(COMPOSER).toContain("sexo: e.snapshot.sexo");
    expect(COMPOSER).not.toContain("indicatorSeverities(e.snapshot as never)");
  });

  it("y los dos llamadores del composer sacan el sexo del SELLO, no de la ficha", () => {
    // Un documento clinico de hace un año no puede cambiar de veredicto porque alguien corrija el sexo
    // en la ficha. Los dos sitios que componen la historia tienen que leerlo del snapshot.
    for (const archivo of [
      "src/modules/reports/data/hc-documento-reader.ts",
      "src/app/(app)/ani-bis-e/[id]/page.tsx",
    ]) {
      const src = readFileSync(archivo, "utf8");
      expect(src, `${archivo} no pasa el sexo del sello al composer`).toMatch(
        /sexo: (engine|results)\.snapshot?\.?sexo|sexo: engine\.sexo|sexo: results\.snapshot\.sexo/,
      );
    }
  });
});
