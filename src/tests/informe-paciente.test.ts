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

  it("traduce en vez de descartar cuando la acción es del paciente", () => {
    expect(paraElPaciente("Manejo de estrés crónico — correlaciona con IRC elevado")).toBe(
      "Manejo de estrés crónico",
    );
    expect(urgenciaParaElPaciente("OBLIGATORIA — sin ejercicio los nutracéuticos son insuficientes")).toBe(
      "obligatoria",
    );
    expect(urgenciaParaElPaciente("recomendada si IAE > 10 años")).toBe("recomendada");
  });

  it("pero una VALORACIÓN ya no sale como texto: sale como remisión", () => {
    // ESTE CASO CAMBIÓ DE SIGNO (Santiago, 2026-11-03), y cambió a petición de quien lo había decidido.
    // Decía que "Valoración médica si IAE > 10 años" tenía que llegar al paciente como "Valoración
    // médica". Y era coherente entonces; lo que lo invalida es que el informe YA le dice a quién acudir y
    // con qué urgencia, en su propio bloque de remisiones, desde el mismo derivador que la historia
    // clínica. La línea de texto era la MISMA cosa dicha dos veces, y la versión recortada era la peor:
    // "Valoración médica" sin a quién ni cuándo.
    expect(paraElPaciente("Valoración médica si IAE > 10 años")).toBeNull();
    // Y NO SE PIERDE NADA: el componente médico de una ruta nunca viajaba como texto (lo dice
    // `indicacionesParaElPaciente`), y las remisiones salen de `remisionesExigidas`.
  });

  it("y el contenido de ALIMENTACIÓN ya no va en el informe: va en la hoja del plan", () => {
    // EL OTRO CASO QUE CAMBIÓ DE SIGNO. Decía que "Omega-3 dietario: ≥2 porciones pescado graso/semana"
    // pasaba entero, y que si el filtro vaciaba la sección nutricional era "la forma silenciosa de que un
    // bloque deje de existir". Las dos cosas siguen siendo verdad sobre el mecanismo; lo que cambió es el
    // DOCUMENTO: desde el 2026-10-30 el paciente recibe una hoja del plan aparte, con su menú, su lista de
    // intercambio y lo que le conviene evitar, calculada PARA ÉL.
    //
    // Y ENTONCES ESTA LÍNEA PASÓ A SER UN PROBLEMA, no una ayuda: es una indicación GENERAL del modelo,
    // junto a una hoja con las cantidades SUYAS. Dos fuentes de la misma cosa, y la general contradice a
    // la propia. Santiago, 2026-11-03: *"sin contenido de alimentación (va en la hoja del plan)."*
    expect(paraElPaciente("Omega-3 dietario: ≥2 porciones pescado graso/semana")).toBeNull();
    expect(paraElPaciente("Antioxidantes: cúrcuma, jengibre, té verde")).toBeNull();
    // LO QUE EL PACIENTE PUEDE HACER SIGUE PASANDO ENTERO, que es la mitad que no cambia.
    expect(paraElPaciente("Camina 30 minutos al día")).toBe("Camina 30 minutos al día");
    expect(paraElPaciente("Manejo de estrés crónico")).toBe("Manejo de estrés crónico");
  });

  it("y el informe no se queda mudo: lo que sobrevive está fijado ruta por ruta", () => {
    // La garantía de que el filtro no lo quita todo NO se mide ya contando líneas del componente
    // nutricional (que ahora es casi todo de la hoja del plan, por decisión): vive en
    // `que-llega-al-paciente-de-las-rutas`, que FIJA la lista superviviente de cada una de las seis rutas
    // y nombra la única que se queda sin nada, que es un pendiente de Gildardo y no un hueco del filtro.
    const utiles = Object.values(RUTAS_CONTENT).flatMap((r) =>
      [r.componentes.nutricional, r.componentes.ejercicio, r.componentes.psicologico]
        .flatMap((c) => c.indicaciones)
        .map(paraElPaciente)
        .filter(Boolean),
    );
    expect(utiles.length, "el filtro dejó al informe sin nada que decirle al paciente").toBeGreaterThan(10);
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
