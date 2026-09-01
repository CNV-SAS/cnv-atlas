import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  adjustmentSignature,
  guidelinesSignature,
  menuSemanalSignature,
  intercambioSignature,
  nutraceuticalsSignature,
  objetivoSignature,
  restriccionesSignature,
  sectionKey,
  tiemposActivosSignature,
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
  cadena: sectionKey(
    "cadena",
    adjustmentSignature({
      treatmentId: T,
      adjGeb: null,
      adjPal: null,
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
  adjDeficit: null,
      pesoMetaFijado: null,
    }),
  ),
  intercambio: sectionKey("intercambio", intercambioSignature({ treatmentId: T, intercambio: null })),
  tiempos: sectionKey("tiempos", tiemposSignature({ treatmentId: T, tiempos: null })),
  restricciones: sectionKey("restricciones", restriccionesSignature({ treatmentId: T, restricciones: [] })),
  nutraceuticos: sectionKey("nutraceuticos", nutraceuticalsSignature({ treatmentId: T, nutraceuticals: [] })),
  // Las dos que faltaban. `tiempos-activos` y `menu-semanal` se agregaron despues de escribir este
  // candado y nadie las anadio aqui: el test seguia verde mirando siete secciones de las ocho que hay.
  "tiempos-activos": sectionKey("tiempos-activos", tiemposActivosSignature({ treatmentId: T, activos: null })),
  "menu-semanal": sectionKey("menu-semanal", menuSemanalSignature({ treatmentId: T, menu: null })),
};

// LAS SECCIONES REALES, LEIDAS DEL CODIGO. La lista de arriba tiene que escribirse a mano (cada firma
// recibe argumentos distintos), y una lista a mano envejece: este candado llevaba semanas mirando
// `guias`, que se retiro en el cotejo, y sin mirar `tiempos-activos` ni `menu-semanal`, que se agregaron
// despues. Verde, y cubriendo siete de ocho.
//
// Es la misma familia del candado anclado a una entrega superada: pasaba por construccion. Por eso ahora
// la lista de la verdad se DERIVA del codigo y lo escrito a mano se compara contra ella.
const FUENTES = [
  "src/modules/treatment/components/treatment-panel.tsx",
  "src/app/(app)/evaluaciones/[id]/page.tsx",
];
const SECCIONES_REALES = new Set(
  FUENTES.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/sectionKey\(\s*"([a-z-]+)"/g)].map((m) => m[1])),
);

describe("keys de las secciones del panel de tratamiento", () => {
  it("la lista de este candado cubre TODAS las secciones que existen, y ninguna que no", () => {
    // Sin esto, agregar una seccion nueva deja el candado verde sin cubrirla, y retirar una lo deja
    // probando algo que ya no existe. Las dos cosas pasaron.
    const cubiertas = new Set(Object.keys(KEYS_VACIAS));
    const sinCandado = [...SECCIONES_REALES].filter((x) => !cubiertas.has(x));
    const fantasma = [...cubiertas].filter((x) => !SECCIONES_REALES.has(x));
    expect(sinCandado, `secciones del panel SIN candado de key: ${sinCandado.join(", ")}`).toEqual([]);
    expect(fantasma, `el candado prueba secciones que ya no existen: ${fantasma.join(", ")}`).toEqual([]);
    // CONTROL: si la extraccion fallara, las dos listas quedarian vacias y el test pasaria sin mirar nada.
    expect(SECCIONES_REALES.size).toBeGreaterThanOrEqual(8);
  });

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
