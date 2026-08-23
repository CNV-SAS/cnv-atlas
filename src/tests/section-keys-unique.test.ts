import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  adjustmentSignature,
  guidelinesSignature,
  intercambioSignature,
  nutraceuticalsSignature,
  objetivoSignature,
  restriccionesSignature,
  sectionKey,
  tiemposSignature,
} from "@/modules/treatment/data/protocol-signature";

// CANDADO DE LAS KEYS DEL PANEL (defecto real, consola de Santiago 2026-08-23).
//
// Las secciones editables se keyean por su FIRMA para remontarse cuando el servidor cambia algo (el
// bug del estado pegado). Pero la firma es "treatmentId + contenido", asi que DOS SECCIONES SIN DATO
// GUARDADO producen la MISMA firma: `T§` (objetivo, guias, restricciones y nutraceuticos vacios) y
// `T§none` (intercambio y tiempos sin guardar). Eso pasa SIEMPRE en un paciente nuevo, y React avisa
// "Encountered two children with the same key" y advierte que puede DUPLICAR U OMITIR hijos.
//
// El riesgo concreto no es que desaparezca una seccion (en el montaje inicial se renderizan todas):
// es que en una ACTUALIZACION la reconciliacion por key case dos hermanos distintos y remonte el que
// no era, perdiendo el estado local (lo que el profesional esta escribiendo). Es exactamente el
// defecto que la firma venia a evitar.
//
// El arreglo NO toca la firma (es la base del candado de concurrencia; cliente y servidor deben
// computar lo mismo): la key pasa a ser "que seccion es" + firma, via sectionKey.

const T = "3bfbcc45-0000-4000-8000-000000000000";

// Paciente NUEVO: ninguna seccion tiene dato guardado. Es el caso que colisiona siempre.
const KEYS_VACIAS: Record<string, string> = {
  objetivo: sectionKey("objetivo", objetivoSignature({ treatmentId: T, objetivo: null })),
  guias: sectionKey("guias", guidelinesSignature({ treatmentId: T, guidelines: [] })),
  cadena: sectionKey(
    "cadena",
    adjustmentSignature({
      treatmentId: T,
      adjGeb: null,
      adjPal: null,
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
      adjPesoMeta: null,
    }),
  ),
  intercambio: sectionKey("intercambio", intercambioSignature({ treatmentId: T, intercambio: null })),
  tiempos: sectionKey("tiempos", tiemposSignature({ treatmentId: T, tiempos: null })),
  restricciones: sectionKey("restricciones", restriccionesSignature({ treatmentId: T, restricciones: [] })),
  nutraceuticos: sectionKey("nutraceuticos", nutraceuticalsSignature({ treatmentId: T, nutraceuticals: [] })),
};

describe("keys de las secciones del panel de tratamiento", () => {
  it("son UNICAS en un paciente nuevo, donde todas las firmas son vacias", () => {
    const keys = Object.values(KEYS_VACIAS);
    expect(new Set(keys).size, `keys duplicadas: ${keys.join(" , ")}`).toBe(keys.length);
  });

  it("las firmas SIN el prefijo si colisionan: es lo que hay que seguir cubriendo", () => {
    // Deja escrito POR QUE hace falta el prefijo. Si algun dia las firmas dejaran de colisionar, este
    // test lo dice en vez de que el prefijo quede como cargo cult.
    const soloFirmas = [
      objetivoSignature({ treatmentId: T, objetivo: null }),
      guidelinesSignature({ treatmentId: T, guidelines: [] }),
      restriccionesSignature({ treatmentId: T, restricciones: [] }),
      intercambioSignature({ treatmentId: T, intercambio: null }),
      tiemposSignature({ treatmentId: T, tiempos: null }),
    ];
    expect(new Set(soloFirmas).size).toBeLessThan(soloFirmas.length);
  });

  it("la key sigue MOVIENDOSE cuando cambia el dato (el remonte no se pierde por el prefijo)", () => {
    const antes = sectionKey("objetivo", objetivoSignature({ treatmentId: T, objetivo: null }));
    const despues = sectionKey("objetivo", objetivoSignature({ treatmentId: T, objetivo: "Bajar grasa" }));
    expect(despues).not.toBe(antes);
  });

  it("el prefijo NO se cuela en la firma que viaja al servidor (es el candado de concurrencia)", () => {
    // La firma es lo que el cliente manda como baseSignature y el servidor recomputa bajo lock. Si el
    // prefijo entrara ahi, cliente y servidor dejarian de coincidir y todo guardado se rechazaria.
    const firma = objetivoSignature({ treatmentId: T, objetivo: "Bajar grasa" });
    expect(firma.startsWith(T)).toBe(true);
    expect(firma).not.toContain("objetivo:");
  });
});

// El test de arriba blinda el HELPER. Este blinda los SITIOS DE LLAMADA, que es donde estaba el
// defecto: una key nueva que use la firma pelada vuelve a colisionar y el candado anterior no se
// entera (mismo patron que "un test que verifica que algo EXISTE no verifica que sea correcto").
describe("los sitios que keyean por firma usan sectionKey", () => {
  const FUENTES = [
    "src/modules/treatment/components/treatment-panel.tsx",
    "src/app/(app)/evaluaciones/[id]/page.tsx",
  ];

  it("ningun key={...Signature(...)} queda sin prefijo de seccion", () => {
    for (const f of FUENTES) {
      const src = readFileSync(f, "utf8");
      const pelados = [...src.matchAll(/key=\{\s*(\w*Signature)\(/g)].map((m) => `${f}: key={${m[1]}(`);
      expect(pelados, `key por firma sin sectionKey (colisiona con otra seccion vacia)`).toEqual([]);
    }
  });
});
