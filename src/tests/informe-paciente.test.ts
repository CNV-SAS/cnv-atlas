import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { buildRemisiones, consolidateRemisiones, RUTAS_CONTENT } from "@/clinical-engine/rutas-content";

vi.mock("server-only", () => ({}));

const { paraElPaciente, urgenciaParaElPaciente } = await import(
  "@/modules/reports/data/informe-paciente-reader"
);

// ═══ AL PACIENTE NO LE LLEGA EL LENGUAJE DEL MODELO, NI POR LOS DATOS ═══
//
// LA INSTRUCCIÓN ES DE GILDARDO (§7.1): *"lo que hoy le mandan -IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el
// código N_N_N_A- NO DEBE SALIR ASÍ. Ningún índice del modelo va al paciente. Eso es el documento del
// profesional."*
//
// Y EL RIESGO CAMBIÓ DE PUERTA (2026-09-19). Ya había un candado que miraba el CÓDIGO del documento y
// prohibía esos nombres escritos a mano. Al sumar las rutas al informe, los índices empezaron a llegar por
// los DATOS, y el primer filtro los atrapó en las indicaciones pero NO en el campo de urgencia de las
// remisiones, que también es texto suyo: a Santiago le salió impreso "valoración recomendada si IAE > 10
// años". Por eso este candado recorre TODO lo que el informe compone a partir de su contenido, no una
// parte.
//
// LA REGLA QUE SE BLINDA: la acción sin la condición. Se traduce, no se descarta, para no perder lo que el
// paciente sí puede hacer.

const INDICES = [
  "IFC",
  "IRC",
  "PABU",
  "ICA-BIS",
  "ISCM",
  "IEHH",
  "FFMI",
  "FMI",
  "EB-BIS",
  "IAE",
  "DFI",
  "CMO",
  "HTA",
  "DM2",
  "TCA",
];

function nombraIndice(texto: string): string | null {
  for (const idx of INDICES) {
    if (new RegExp(`(^|[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9-])${idx}([^A-Za-zÁÉÍÓÚÑáéíóúñ0-9-]|$)`).test(texto)) {
      return idx;
    }
  }
  return null;
}

describe("nada de lo que el informe compone nombra un índice", () => {
  it("CONTROL: el contenido real SÍ los trae, o este candado no probaría nada", () => {
    const todas = Object.values(RUTAS_CONTENT).flatMap((r) =>
      Object.values(r.componentes).flatMap((c) => c.indicaciones),
    );
    expect(todas.length, "no se leyó el contenido de rutas").toBeGreaterThan(20);
    expect(todas.some((i) => nombraIndice(i) !== null)).toBe(true);
    // Y en las urgencias, que es por donde se coló: "recomendada si IAE > 10 años".
    const urgencias = Object.values(RUTAS_CONTENT)
      .flatMap((r) => Object.values(r.componentes))
      .map((c) => c.urgencia)
      .filter((u): u is string => Boolean(u));
    expect(urgencias.some((u) => nombraIndice(u) !== null)).toBe(true);
  });

  it("las INDICACIONES traducidas no nombran ninguno, en las seis rutas", () => {
    for (const ruta of Object.values(RUTAS_CONTENT)) {
      for (const componente of Object.values(ruta.componentes)) {
        for (const linea of componente.indicaciones) {
          const salida = paraElPaciente(linea);
          if (salida === null) continue;
          expect(nombraIndice(salida), `${ruta.id}: "${linea}" salió como "${salida}"`).toBeNull();
        }
      }
    }
  });

  it("las URGENCIAS traducidas tampoco, ni las consolidadas entre rutas", () => {
    // Se prueban las dos formas en que llegan al informe: la del componente, y la que sale del
    // consolidador (que elige la más alta entre rutas y es la que el lector usa de verdad).
    for (const ruta of Object.values(RUTAS_CONTENT)) {
      for (const componente of Object.values(ruta.componentes)) {
        const salida = urgenciaParaElPaciente(componente.urgencia ?? null);
        if (salida === null) continue;
        expect(nombraIndice(salida), `${ruta.id}: urgencia "${componente.urgencia}" salió como "${salida}"`).toBeNull();
      }
    }
    for (const rem of consolidateRemisiones(buildRemisiones(Object.values(RUTAS_CONTENT)))) {
      const salida = urgenciaParaElPaciente(rem.urgencia ?? null);
      if (salida === null) continue;
      expect(nombraIndice(salida), `remisión a ${rem.profesional}: "${rem.urgencia}"`).toBeNull();
    }
  });

  it("NINGUNA sale con guion largo: ni indicaciones, ni urgencias, ni títulos de ruta", () => {
    // Su archivo los usa ("OBLIGATORIA — sin ejercicio los nutracéuticos son insuficientes"). No se edita
    // su original: se cambia en lo que mostramos.
    for (const ruta of Object.values(RUTAS_CONTENT)) {
      for (const componente of Object.values(ruta.componentes)) {
        for (const linea of componente.indicaciones) {
          expect(paraElPaciente(linea) ?? "").not.toContain("—");
        }
        expect(urgenciaParaElPaciente(componente.urgencia ?? null) ?? "").not.toContain("—");
      }
    }
  });

  it("traduce en vez de descartar: la acción se conserva", () => {
    expect(paraElPaciente("Valoración médica si IAE > 10 años")).toBe("Valoración médica");
    expect(paraElPaciente("Manejo de estrés crónico — correlaciona con IRC elevado")).toBe(
      "Manejo de estrés crónico",
    );
    expect(urgenciaParaElPaciente("OBLIGATORIA — sin ejercicio los nutracéuticos son insuficientes")).toBe(
      "obligatoria",
    );
    expect(urgenciaParaElPaciente("recomendada si IAE > 10 años")).toBe("recomendada");
  });

  it("y lo que el paciente ya entendía pasa entero", () => {
    const linea = "Omega-3 dietario: ≥2 porciones pescado graso/semana";
    expect(paraElPaciente(linea)).toBe(linea);
    expect(paraElPaciente("Camina 30 minutos al día")).toBe("Camina 30 minutos al día");
  });

  it("el filtro no deja al paciente sin indicaciones de alimentación", () => {
    // Un traductor que lo descartara todo cumpliría la regla y vaciaría la sección, que es la forma
    // silenciosa de que un bloque deje de existir.
    const utiles = Object.values(RUTAS_CONTENT).flatMap((r) =>
      r.componentes.nutricional.indicaciones.map(paraElPaciente).filter(Boolean),
    );
    expect(utiles.length).toBeGreaterThan(10);
  });
});

describe("el informe reúne, no construye (Regla 0)", () => {
  const LECTOR = readFileSync("src/modules/reports/data/informe-paciente-reader.ts", "utf8");

  it("las remisiones salen del MISMO derivador que la historia clínica", () => {
    // Si aquí se dedujeran otra vez, el documento del paciente y el del profesional podrían nombrar
    // remisiones distintas de la misma consulta, y eso ya pasó una vez con esta misma sección.
    expect(LECTOR).toContain("remisionesExigidas(");
  });

  it("los suplementos del modelo salen del protocolo, no de una lista escrita aquí", () => {
    expect(LECTOR).toContain("recommendedNutraceuticals");
    expect(LECTOR).toContain("protocolo?.nutraceuticals");
  });

  it("las rutas salen del snapshot CONGELADO, no del registry vivo", () => {
    // El documento tiene que decir lo que se prescribió ese día, no lo que diría el modelo de hoy.
    expect(LECTOR).toContain("rutasContent");
    expect(LECTOR, "el informe no puede resolver rutas contra el contenido vivo").not.toContain(
      "resolveRutasContent(",
    );
  });
});
