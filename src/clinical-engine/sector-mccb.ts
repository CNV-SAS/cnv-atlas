// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL SECTOR DE LA DIANA, CON SU CODIGO S1-S9 Y SU FENOTIPO  ·  v17 §2.4  ·  2026-11-12
//
// POR QUE EXISTE ESTE MODULO, en una linea: para que el codigo del sector, su posicion en la Diana y
// su nombre salgan de UNA sola fuente y no puedan decir tres cosas distintas.
//
// Hasta la v16 el sector se rotulaba `E1` a `E9` (y antes `R1` a `R9`, renombrado el 9-ago-2026 porque
// chocaba con las rutas de atencion R1-R6). Su v17 lo renombra a `S1` a `S9`, que son los sectores del
// libro, y les pone nombre y gravedad en su Tabla 11.2. El cambio de letra es un ROTULO; lo que no es un
// rotulo es que ahora cada sector trae una GRAVEDAD que alimenta el dominio metabolico-estructural.
//
// LA DERIVACION ES POR INDICE, Y ESO ES DELIBERADO. `MCCB_SECTORES` esta ordenado S1..S9 en el MISMO
// orden que `EFR_RISK_ORDER` de `types.ts` (verificado par por par: S1 = (3,1) FFMI alto con FMI bajo =
// atletico magro; S5 = (3,3) obesidad muscular; S7 = (1,1) desnutricion bilateral; S8 = (1,2)
// normal-sarcopenica; S9 = (1,3) obesidad sarcopenica). Asi que el sector se puede resolver por el rango
// que YA decide la posicion y el color de la celda, en vez de por sus dos bandas. La diferencia importa
// en un caso real: sin sexo, `sectorMCCB` del frozen devuelve null (su regla), pero la Diana SI pinta una
// celda, porque las bandas caen a las del clasificador anterior (su linea 7912). Derivando por indice, el
// rotulo nunca se queda vacio sobre una celda pintada, ni puede nombrar otra celda que la encendida.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import * as core from "./frozen/engine.core.derived.js";
import { efrRiskRank, type SectorDiana } from "./types";

export type { SectorDiana };

const SECTORES = core.MCCB_SECTORES as readonly core.SectorMCCB[];

/** Los nueve sectores del libro, en el orden de riesgo de la Diana (indice 0 = S1). */
export const SECTORES_DIANA: readonly SectorDiana[] = SECTORES.map((s) => ({
  id: s.id,
  fenotipo: s.fen,
  gravedad: s.g,
}));

/** El sector que corresponde a un indice de la Diana (0..8). Fuera de rango, null. */
export function sectorDelIndice(sectorIndex: number): SectorDiana | null {
  return SECTORES_DIANA[sectorIndex] ?? null;
}

/** El sector que corresponde a un par de bandas (FFMI x FMI), por el mismo rango que la Diana. */
export function sectorDeLasBandas(ffmiK: number, fmiK: number): SectorDiana | null {
  return sectorDelIndice(efrRiskRank(ffmiK, fmiK));
}
