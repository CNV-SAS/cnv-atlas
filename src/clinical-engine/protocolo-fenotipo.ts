// Clasificador de fenotipo MCCB (F1-F12) + obesidad sarcopenica.
//
// TRANSCRIPCION de la logica INLINE de motorDiagnostico (ATLAS_v7.html:11060-11105, VIGENTE) y de la
// funcion dxSarcopenia (ATLAS_v7.html:3417-3435). Cada linea va anotada con su origen. RE-ANCLADO al
// vigente el 2026-08-02 (antes anclaba a julio): Gildardo unifico la frontera de desnutricion (FMI H
// 3.5->3.0, FFMI H 17.92->17, M 15.64->15). Cambia la clasificacion sellada de pacientes en esas
// franjas -> bump de emission_versions.structural_mccb. Ver GILDARDO_QUERIES Q19 y el re-sync en BACKLOG.
//
// POR QUE AQUI Y NO EN frozen/: la ciencia vive INLINE dentro de motorDiagnostico, no como un
// artefacto/funcion independiente. frozen/ significa "byte-identico a un artefacto independiente",
// y un fragmento inline no lo es (misma decision que la cadena calorica, A3.2). La fidelidad NO se
// prueba con un DIFF de este archivo, sino con el golden (protocolo-fenotipo.golden.test.ts): cada
// salida se compara contra el harness Via C, que corre los BYTES verbatim de Gildardo.
//
// La TABLA FENOTIPOS_MCCB si es contenido verbatim (datos, no logica): vive en fenotipos-mccb.ts
// con su DIFF byte a byte (frozen-fenotipo-diff.test.ts). Aqui solo se importa.
//
// BRECHA DECLARADA (fuerza prensil): en Atlas la dinamometria NO entra al motor (solo captura,
// Q5), asi que `fuerzaPrensil` llega SIEMPRE en su fallback (0). Con prensil=0, dxSarcopenia
// retorna en su PRIMER guard (k=0, ATLAS.html:3419) ANTES de mirar ASMI/AF, de modo que el
// disyunto `sarcoDx.k >= 2` de `sarcopenia` NUNCA se activa en produccion: la sarcopenia se decide
// solo por smmW. La transcripcion de dxSarcopenia es fiel (el golden la ejercita con prensil > 0),
// pero esa rama esta muerta mientras no entre la dinamometria. Si algun dia entra, revive aqui sin
// cambiar codigo. ASMI, en cambio, SI es input vivo e independiente: entra por `asmiLow`, que no
// pasa por dxSarcopenia. Se deriva (MMEM/talla^2) en biody-import.ts, igual que FMI.

import { FENOTIPOS_MCCB, type Fenotipo } from "./fenotipos-mccb";

export type NivelFMI = "normal" | "bajo" | "alto_clinico" | "alto_preclinico";
export type NivelFFMI = "bajo" | "normal" | "alto";

export interface FenotipoInput {
  FMI: number;
  FFMI: number;
  MCA: number;
  MCA_ref: number;
  smmW: number;
  ASMI: number;
  AF: number;
  fuerzaPrensil?: number; // brecha: en Atlas siempre 0 (ver encabezado)
  sexoM: boolean;
}

export interface FenotipoResult {
  fenotipo: Fenotipo;
  nivelFMI: NivelFMI;
  nivelFFMI: NivelFFMI;
  MCA_ok: boolean;
  sarcopenia: boolean;
  asmiLow: boolean;
  obesidadSarcopenica: boolean;
}

export interface SarcoDx {
  l: string;
  c: string;
  k: number;
  detalle: string;
}

// dxSarcopenia — EWGSOP2 (ATLAS.html:3414-3432). Con fuerza<=0 retorna k=0 en el primer guard
// (la brecha de la prensil); Atlas siempre entra por ahi.
export function dxSarcopenia(fuerza: number, asmi: number, af: number, sexoM: boolean): SarcoDx {
  const fz = parseFloat(String(fuerza)) || 0, am = parseFloat(String(asmi)) || 0, an = parseFloat(String(af)) || 0; // :3415
  const fzLow = fz > 0 && fz < (sexoM ? 27 : 16); // :3416
  const amLow = am > 0 && am < (sexoM ? 7.0 : 5.5); // :3417
  const anLow = an > 0 && an < (sexoM ? 6.5 : 6.0); // :3418
  if (fz <= 0) return { l: "Ingrese fuerza prensil", c: "#94a3b8", k: 0, // :3419
    detalle: "Falta la dinamometría (criterio primario de fuerza EWGSOP2)." };
  if (!fzLow && !amLow) return { l: "Sin sarcopenia", c: "#16a34a", k: 0, // :3421
    detalle: "Fuerza y masa muscular normales" + (anLow ? "; AF bajo → vigilar calidad celular." : ".") };
  if (fzLow && !amLow) return { l: "Sarcopenia probable", c: "#f59e0b", k: 1, // :3423
    detalle: "Fuerza baja con masa conservada (EWGSOP2: probable). Confirmar con masa/DXA." };
  if (!fzLow && amLow) return { l: "Baja masa muscular — vigilar", c: "#f59e0b", k: 1, // :3425
    detalle: "ASMI bajo con fuerza normal; no cumple sarcopenia (la fuerza es criterio primario)." };
  return anLow // :3427
    ? { l: "Sarcopenia severa", c: "#7b0000", k: 3,
        detalle: "Fuerza + masa bajas y AF bajo (calidad celular comprometida)." }
    : { l: "Sarcopenia confirmada", c: "#dc2626", k: 2,
        detalle: "Fuerza baja + masa muscular baja (EWGSOP2: confirmada)." };
}

// Bandas de FMI (ATLAS.html:10870-10884): normal/bajo/alto_clinico/alto_preclinico, por sexo. El
// tramo `alto` se parte en clinico/preclinico segun MCA_ok.
function computeNivelFMI(FMI: number, MCA_ok: boolean, sexoM: boolean): NivelFMI {
  if (sexoM) {
    if (FMI <= 0) return "normal"; // :11068 (vigente)
    if (FMI < 3.0) return "bajo"; // :11069 (vigente, unificado con cFMI: H<3; antes julio 3.5)
    if (FMI <= 6.0) return "normal"; // :11070 (vigente)
    if (!MCA_ok) return "alto_clinico"; // :10875
    return "alto_preclinico"; // :10876
  } else {
    if (FMI <= 0) return "normal"; // :10878
    if (FMI < 5.0) return "bajo"; // :10879
    if (FMI <= 9.0) return "normal"; // :10880
    if (!MCA_ok) return "alto_clinico"; // :10881
    return "alto_preclinico"; // :10882
  }
}

// Bandas de FFMI (ATLAS_v7.html:11082-11088, VIGENTE): bajo/normal/alto, por sexo. La frontera de
// 'bajo' esta UNIFICADA con cFFMI (H<17 · M<15; antes de julio: 17.92 / 15.64). La superior (21.59 /
// 19.34) es la del mapa MCCB y NO coincide con cFFMI (25/23) a proposito: cFFMI usa 25/23 para
// "sospecha de anabolizantes", otro concepto (ver GILDARDO_QUERIES Q19).
function computeNivelFFMI(FFMI: number, sexoM: boolean): NivelFFMI {
  if (sexoM) return FFMI < 17 ? "bajo" : FFMI <= 21.59 ? "normal" : "alto"; // :11086 (vigente)
  return FFMI < 15 ? "bajo" : FFMI <= 19.34 ? "normal" : "alto"; // :11087 (vigente)
}

// Fallback verbatim cuando la clave no existe en la tabla (ATLAS.html:10906).
const NO_CLASIFICADO: Fenotipo = { id: "F?", nombre: "No clasificado", riesgo: "bajo", color: "#64748b" };

export function classifyFenotipo(i: FenotipoInput): FenotipoResult {
  const MCA_ok = i.MCA >= i.MCA_ref; // :10868
  const nivelFMI = computeNivelFMI(i.FMI, MCA_ok, i.sexoM);
  const nivelFFMI = computeNivelFFMI(i.FFMI, i.sexoM);
  const keyMCCB = nivelFMI + "_" + nivelFFMI; // :10905
  const fenotipo = FENOTIPOS_MCCB[keyMCCB] ?? NO_CLASIFICADO; // :10906

  const smmW = i.smmW; // :10908
  const _fzP = i.fuerzaPrensil ?? 0; // :10910 (brecha: siempre 0 en Atlas)
  const sarcoDx = dxSarcopenia(_fzP, i.ASMI, i.AF, i.sexoM); // :10911-10913
  // Gate SMM/W: mujer 24 -> 22 (RESPUESTA_GILDARDO 2026-08-19 §1). El 24 era un resto: el umbral masculino
  // del mismo gate es 27 = cSMM clavado; un criterio externo diferiria en ambos sexos, no solo en mujeres.
  // Una mujer con SMM/W 23 salia "Normal" por cSMM y "sarcopenica" por este gate. Ahora coinciden.
  const sarcopenia = (i.sexoM ? smmW < 27 : smmW < 22) || sarcoDx.k >= 2; // :10914
  const asmiLow = i.ASMI > 0 && i.ASMI < (i.sexoM ? 7.0 : 5.5); // :10915
  const obesidadSarcopenica =
    fenotipo.id === "F1" || fenotipo.id === "F4" ||
    ((sarcopenia || asmiLow) && (nivelFMI === "alto_clinico" || nivelFMI === "alto_preclinico")); // :10916

  return { fenotipo, nivelFMI, nivelFFMI, MCA_ok, sarcopenia, asmiLow, obesidadSarcopenica };
}
