// ─────────────────────────────────────────────────────────────────────────────
// ADAPTADOR del motor clinico (NUESTRO codigo TS, no congelado). Reemplaza el
// index.ts de conveniencia que Gildardo escribio aparte: orquesta la ciencia
// CONGELADA (frozen/) en el MISMO orden que el prototipo y expone un unico punto de
// entrada. La app nunca llama a los .js congelados directamente.
//
// DIVERGENCIA CORREGIDA vs el index.ts de Gildardo (hallazgo B11, informativo para
// Gildardo, NUNCA se toca la ciencia congelada): su index.ts arma el objeto para
// computeISCM como { ...imp.raw, ifc } y OMITE FMI (que es derivado, no una columna
// cruda), asi que ISCM salia -1.568 en vez del oro -2.072. El HTML (ATLAS_v7.html
// L5700) y la funcion congelada computeISCM SI usan bis.FMI; el olvido estaba solo en
// su glue. Aqui pasamos FMI explicito. Los golden tests anclan -2.072.
// ─────────────────────────────────────────────────────────────────────────────

import type { Clase } from "./frozen/engine.core";
import * as core from "./frozen/engine.core.js";
import type { DFIResult } from "./frozen/engine.dfi";
import * as dfi from "./frozen/engine.dfi.js";
import * as ix from "./frozen/engine.indices.js";
import { type BiodyImport, parseBiodyRow } from "./edge/biody-import";
import { normalizeSexo, type SexoCanonico } from "./edge/normalize";

/** Contexto de encuesta necesario SOLO para EB-BIS/IAE (opcional). */
export interface ContextoEncuesta {
  icec?: number | null; // ICEC/LE8 total de la encuesta (calcLE8)
  edad?: number | null; // edad cronologica (anos)
}

export interface AnalisisANIBISE {
  sexo: SexoCanonico;
  indices: {
    IFC: number;
    IRC: number;
    PABU: number;
    FMI: number;
    FFMI: number;
    ISCM: number | null;
    IEHH: number | null;
    EB_BIS: number | null;
    IAE: number | null;
  };
  clases: {
    IFC: { l: string; k: number };
    IRC: { l: string; k: number };
    PABU: { l: string };
    FMI: { l: string; k: number };
    FFMI: { l: string; k: number };
    ISCM: { l: string } | null;
    IEHH: { l: string } | null;
    IAE: { l: string } | null;
  };
  fenotipoEFR: { key: string; dx: string | null; nutraceuticos: string };
  fuente: BiodyImport;
}

// Insumos secundarios que habilitan ISCM (todos presentes o ISCM = null).
const SECONDARY_FIELDS = ["FFW", "MCA_dif", "ECW_sg", "ICW_sg"] as const;

/**
 * Punto de entrada oficial (composicion BIS). `row` = fila cruda del Excel Biody;
 * `sexoRaw` = sexo de la encuesta (o del Biody); `enc` = contexto opcional (EB-BIS/IAE).
 * Devuelve el analisis o LANZA ClinicalInputError si el import no es apto.
 */
export function analizarDesdeBiody(
  row: Record<string, unknown>,
  sexoRaw: unknown,
  enc: ContextoEncuesta = {},
): AnalisisANIBISE {
  const sexo = normalizeSexo(sexoRaw);
  const imp = parseBiodyRow(row);

  const IFC = core.calcIFC(imp.C, imp.Rinf);
  const IRC = core.calcIRC(imp.Re, imp.Ri, imp.C);
  const PABU = core.calcPABU(imp.Re, imp.Ri, imp.Rinf, imp.C, sexo);

  // Indices secundarios (100% del Excel si vienen los insumos). FIX: FMI explicito.
  const secOk = SECONDARY_FIELDS.every((f) => imp.raw[f] != null);
  const ISCM = secOk ? ix.computeISCM({ ...imp.raw, ifc: IFC, FMI: imp.FMI }) : null;
  const IEHH =
    imp.raw.FFW != null
      ? ix.computeIEHH({ Re: imp.Re, Rinf: imp.Rinf, C: imp.C, FFW: imp.raw.FFW })
      : null;

  // EB-BIS/IAE: solo si la encuesta aporta ICEC.
  const EB_BIS = enc.icec != null ? ix.computeEBBIS(IFC, PABU, enc.icec) : null;
  const IAE = ix.computeIAE(EB_BIS, enc.edad ?? null);

  const cIFC = core.cIFC(IFC, sexo);
  const cIRC = core.cIRC(IRC, sexo);
  const cPABU = core.cPABU(PABU, IFC);
  const cFMI = core.cFMI(imp.FMI, sexo);
  const cFFMI = core.cFFMI(imp.FFMI, sexo);

  const dx = core.getDX(cIFC.k, cIRC.k, cFFMI.k, cFMI.k);
  const key = `${core.kl(cIFC.k)}_${core.kl(cIRC.k)}_${core.kl(cFFMI.k)}_${core.kl(cFMI.k)}`;

  return {
    sexo,
    indices: { IFC, IRC, PABU, FMI: imp.FMI, FFMI: imp.FFMI, ISCM, IEHH, EB_BIS, IAE },
    clases: {
      IFC: { l: cIFC.l, k: cIFC.k },
      IRC: { l: cIRC.l, k: cIRC.k },
      PABU: { l: cPABU.l },
      FMI: { l: cFMI.l, k: cFMI.k },
      FFMI: { l: cFFMI.l, k: cFFMI.k },
      ISCM: ISCM != null ? { l: core.cISCM(ISCM).l } : null,
      IEHH: IEHH != null ? { l: core.cIEHH(IEHH).l } : null,
      IAE: IAE != null ? { l: core.cIAE(IAE).l } : null,
    },
    fenotipoEFR: { key, dx: dx.dx ?? dx.name ?? null, nutraceuticos: dx.n },
    fuente: imp,
  };
}

/** Rutas activas por condicion (predicados PUROS). La seleccion AUTORITATIVA es via
 *  DFI (analizarDFI); esto queda para logica de reglas, no reemplaza al DFI. */
export function rutasPorCondicion(
  d: Record<string, unknown>,
  dominios?: Array<{ nivel: string }>,
): string[] {
  return ix.rutasPorCondicion(d, dominios);
}
export const RUTA_COND = ix.RUTA_COND;

/**
 * Cadena completa: Excel Biody + encuesta D1-D8 -> indices -> LE8/ICEC -> DFI.
 * Devuelve dominios, riesgo integrado y rutas AUTORITATIVAS. Lanza si el import BIS no
 * es apto. Mismo FIX de FMI en el ISCM que alimenta el DFI.
 */
export function analizarDFI(
  row: Record<string, unknown>,
  enc: Record<string, unknown>,
): DFIResult & { le8: ReturnType<typeof dfi.calcLE8> } {
  const sexo = normalizeSexo(enc.sexo ?? row["Género "]);
  const imp = parseBiodyRow(row);

  const IFC = core.calcIFC(imp.C, imp.Rinf);
  const IRC = core.calcIRC(imp.Re, imp.Ri, imp.C);
  const PABU = core.calcPABU(imp.Re, imp.Ri, imp.Rinf, imp.C, sexo);
  const secOk = SECONDARY_FIELDS.every((f) => imp.raw[f] != null);
  const ISCM = secOk ? ix.computeISCM({ ...imp.raw, ifc: IFC, FMI: imp.FMI }) : 0;
  const IEHH =
    imp.raw.FFW != null
      ? ix.computeIEHH({ Re: imp.Re, Rinf: imp.Rinf, C: imp.C, FFW: imp.raw.FFW })
      : 0;

  const le8 = dfi.calcLE8(enc);
  const EB_BIS = le8.total != null ? ix.computeEBBIS(IFC, PABU, le8.total) : null;
  const IAE = ix.computeIAE(EB_BIS, (enc.edad as number) ?? null);

  // `bis` con indices PRECALCULADOS (evita el bug TDZ del prototipo, que no toca la
  // ciencia congelada: computeDFIFromData corta en num("PABU") antes de usar sexoM).
  const bis = {
    Re: imp.Re,
    Ri: imp.Ri,
    Rinf: imp.Rinf,
    C: imp.C,
    IFC,
    IRC,
    PABU,
    ISCM,
    IEHH,
    IAE,
    EB_BIS,
    FMI: imp.FMI,
    FFMI: imp.FFMI,
  };

  const out = dfi.computeDFIFromData(enc, bis);
  if (!out) {
    throw new Error("analizarDFI: computeDFIFromData no produjo resultado (sin BIS).");
  }
  return { ...out, le8 };
}

export { calcLE8 } from "./frozen/engine.dfi.js";
export { parseBiodyRow, assertEngineInputs } from "./edge/biody-import";
export {
  normalizeSexo,
  toNum,
  parseBiodyDate,
  ClinicalInputError,
} from "./edge/normalize";
export { BIODY_COLUMNS, ENGINE_REQUIRED } from "./edge/biody-columns";
export type { Clase };
