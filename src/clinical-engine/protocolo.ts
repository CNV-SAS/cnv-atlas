// ORQUESTADOR DEL PROTOCOLO (T2 A3). Encadena los tres motores ya verificados y arma los objetos
// que cada uno consume desde (EngineInput, EngineOutput). Es CALCULO clinico -> vive en
// clinical-engine (regla 5), NO en el pipeline. El pipeline solo LLAMA esta funcion y SELLA el
// resultado (paso siguiente). Asi el orquestador es testeable sin BD (su golden encadena los tres
// motores) y el pipeline queda thin.
//
// EL RIESGO DE ESTE ARCHIVO NO ES EL CALCULO (los tres motores estan verificados), ES EL MAPEO:
// sacar cada campo del BIS / la encuesta / el snapshot y ponerlo con el nombre que cada motor
// espera. Es la familia del bug de cintura: ciencia correcta alimentada con el campo equivocado, en
// silencio. El golden (protocolo.golden.test.ts) prueba el mapeo, no solo el encadenado: flags con
// los textos EXACTOS de la encuesta (frozen-survey-texts.ts) y ruteo de campos BIS con valores
// distintos para detectar swaps.
//
// AJUSTE 1 (defaults que propagan): la cadena calorica se sella al DIAGNOSTICAR, sin profesional,
// asi que PAL=1.375 y grasa=30% entran por DEFAULT (calorico.defaults). PAL esta aguas arriba de
// GET -> kcalObj -> proteina/grasa/CHO, de modo que TODA la cadena calorica del set SUGERIDO es
// PROVISIONAL, no solo esas dos claves. Los valores efectivos los fija el profesional al aprobar
// (protocol_approved). La misma afirmacion va en el jsonb (_nota) y junto a protocol_suggested en el
// schema (regla: escribirlo ahora cuesta una frase; write-once, despues cuesta una migracion).

import { parseBiodyRow } from "./edge/biody-import";
// El que CORRE es el GENERADO (original + modificaciones autorizadas del manifiesto), no el original.
import { motorProtocolo } from "./frozen/atlas-protocolo.authorized.js";
import { computeProtocoloCalorico, type ProtocoloCaloricoOutput } from "./protocolo-calorico";
import { classifyFenotipo } from "./protocolo-fenotipo";
import type { Fenotipo } from "./fenotipos-mccb";
import type { EngineInput, EngineOutput } from "./types";
import { PROTOCOL_ENGINE_VERSION } from "./version";

const NOTA_DEFAULTS =
  "Los valores en calórico.defaults son suposiciones del sistema, no decisiones clinicas ni salida " +
  "del modelo. Todo valor derivado aguas abajo de un default es igualmente provisional: la cadena " +
  "calórica completa del set SUGERIDO lo es hasta la aprobación, donde el profesional fija los " +
  "valores efectivos que se sellan en protocol_approved.";

export type ProtocoloSnapshot = {
  protocolEngineVersion: string; // regla 7: la pieza que este motor produce; el resto se hereda via diagnosis_id
  _nota: string; // afirmacion de propagacion de los defaults (ajuste 1)
  fenotipo: Fenotipo; // F1-F12 (classifyFenotipo)
  obesidadSarcopenica: boolean;
  pesoCalculo: number;
  pesoCalculoLabel: string;
  PI: number;
  // `perfil`: orientacion del fenotipo en texto sin cifra (punto 6, 18 2026-08-19); deficit queda en 0.
  estrategia: { tipo: string; deficit: number; label: string; color: string; ref: string; perfil: string };
  protMin: number;
  protMax: number;
  protRef: string;
  restricciones: { nombre: string; valor: string; ref: string }[];
  examenes: { nombre: string; razon: string; protocolo: string; prioridad: string }[];
  suplementacion: { nombre: string; dosis: string; razon: string; vitacellebis: string }[];
  resumenClinico: string; // version del MODELO (la del profesional vive en treatmentDietGuidelines)
  alertaSindRealim: boolean;
  flags: { tieneIRC: boolean; tieneCancer: boolean; tieneDM: boolean; tieneHTA: boolean };
  // Inputs de la cadena calorica, SELLADOS para que approveProtocol recompute el set EFECTIVO con
  // los adj_* del profesional sobre EXACTAMENTE los mismos inputs del sugerido (el BIS es inmutable,
  // pero asi el approve es self-contained y no re-deriva de la evaluacion). deficit/protMin/pesoCalculo
  // ya viven arriba (motorProtocolo).
  caloricoInputs: { ffm: number; talla: number; edad: number; sexoM: boolean };
  calorico: {
    defaults: string[]; // claves que son suposiciones del sistema (no modelo, no profesional)
    pal: number;
    fatPct: number;
    formula: string;
    gebAuto: number;
    geb: number;
    get: number;
    kcalObj: number;
    protGKg: number;
    protG: number;
    protKcal: number;
    fatG: number;
    fatKcal: number;
    choKcal: number;
    choG: number;
    choPct: number;
  };
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// Arma el protocolo sugerido a partir del diagnostico. PURO. Devuelve null si no hay composicion
// minima para calcularlo (peso/talla): el pipeline sella null y el diagnostico se escribe igual (el
// protocolo NO degrada el diagnostico). En la practica no se alcanza: peso/talla son ENGINE_REQUIRED,
// asi que un diagnostico existente ya los tiene; es cinturon defensivo.
export function computeProtocolo(input: EngineInput, output: EngineOutput): ProtocoloSnapshot | null {
  const imp = parseBiodyRow(input.bisRow);
  const peso = imp.peso;
  const talla = imp.talla;
  if (!Number.isFinite(peso) || !Number.isFinite(talla)) return null;
  const sexoM = input.sexo === "M";

  // Clasificador MCCB (A3.4): F1-F12 + obesidad sarcopenica. FMI/FFMI/AF del snapshot (indicadores
  // ya diagnosticados); MCA/MCA_ref/smmW crudos; ASMI derivado (MMEM/talla^2) en biody-import.
  const fen = classifyFenotipo({
    FMI: output.indicators.FMI,
    FFMI: output.indicators.FFMI,
    MCA: num(imp.raw.MCA),
    MCA_ref: num(imp.raw.MCA_ref),
    smmW: num(imp.raw.smmW),
    ASMI: num(imp.ASMI),
    AF: output.indicators.AF,
    sexoM,
  });

  // motorProtocolo (frozen). enc = la encuesta cruda (input.survey): motorProtocolo deriva los flags
  // IRC/cancer/DM/HTA por SUBSTRING sobre el TEXTO de d5_39/d5_36 (contrato en frozen-survey-texts.ts).
  const pr = motorProtocolo(
    {
      sexo: input.sexo,
      irc: output.indicators.irc,
      iscm: output.indicators.iscm,
      iehh: output.indicators.iehh,
      iae: output.indicators.iae,
      FMI: output.indicators.FMI,
      FFMI: output.indicators.FFMI,
      peso,
      talla,
      FFM: imp.FFM,
      imc: num(imp.raw.imc),
      GEB: num(imp.raw.GEB),
    },
    input.survey,
    {
      fenotipo: { id: fen.fenotipo.id, nombre: fen.fenotipo.nombre },
      sectorFR: output.frSector.key,
      nombreFR: output.frSector.nombre,
      obesidadSarcopenica: fen.obesidadSarcopenica,
    },
  );

  // Cadena calorica (A3.2). SIN overrides del profesional al diagnosticar: pal=1.375 y grasa=30% por
  // DEFAULT; pesoN = pesoCalculo (peso_efectivo sin adj_peso_meta). Ver ajuste 1 arriba.
  const cal = computeProtocoloCalorico({
    ffm: imp.FFM,
    pesoN: pr.pesoCalculo,
    talla,
    edad: input.edad,
    sexoM,
    deficit: pr.estrategia.deficit,
    protMin: pr.protMin,
  });

  return {
    protocolEngineVersion: PROTOCOL_ENGINE_VERSION,
    _nota: NOTA_DEFAULTS,
    fenotipo: fen.fenotipo,
    obesidadSarcopenica: fen.obesidadSarcopenica,
    pesoCalculo: pr.pesoCalculo,
    pesoCalculoLabel: pr.pesoCalculoLabel,
    PI: pr.PI,
    estrategia: pr.estrategia,
    protMin: pr.protMin,
    protMax: pr.protMax,
    protRef: pr.protRef,
    restricciones: pr.restricciones,
    examenes: pr.examenes,
    suplementacion: pr.suplementacion,
    resumenClinico: pr.resumenClinico,
    alertaSindRealim: pr.alertaSindRealim,
    flags: {
      tieneIRC: pr.tieneIRC,
      tieneCancer: pr.tieneCancer,
      tieneDM: pr.tieneDM,
      tieneHTA: pr.tieneHTA,
    },
    caloricoInputs: { ffm: imp.FFM, talla, edad: input.edad, sexoM },
    calorico: {
      defaults: ["pal", "fatPct"],
      pal: cal.pal,
      fatPct: cal.fatPct,
      formula: cal.formula,
      gebAuto: cal.gebAuto,
      geb: cal.geb,
      get: cal.get,
      kcalObj: cal.kcalObj,
      protGKg: cal.protGKg,
      protG: cal.protG,
      protKcal: cal.protKcal,
      fatG: cal.fatG,
      fatKcal: cal.fatKcal,
      choKcal: cal.choKcal,
      choG: cal.choG,
      choPct: cal.choPct,
    },
  };
}

// Ajustes del profesional sobre el sugerido (null = usar el default del sugerido/cadena).
export type ProtocoloAjustes = {
  geb: number | null;
  pal: number | null;
  kcalObj: number | null;
  protGkg: number | null;
  fatPct: number | null;
  pesoMeta: number | null;
};

export type ProtocoloEfectivo = {
  pesoEfectivo: number; // adj_peso_meta ?? sugerido.pesoCalculo, entra a TODA la cadena
  calorico: ProtocoloCaloricoOutput; // recomputado con los adj_* sobre los inputs sellados del sugerido
};

// Recomputa el set EFECTIVO al aprobar: aplica los adj_* del profesional sobre EXACTAMENTE los inputs
// sellados del sugerido (caloricoInputs + deficit/protMin), no sobre datos que llegaron despues. Los
// adj_* cascadean (pal cambia GET -> kcalObj -> proteina/grasa/CHO), por eso se RE-CORRE la cadena, no
// se sustituyen valores. PURO (regla 5): el sellado y la autorizacion los hace el modulo de tratamiento.
export function computeProtocoloEfectivo(
  sug: ProtocoloSnapshot,
  adj: ProtocoloAjustes,
): ProtocoloEfectivo {
  const pesoEfectivo = adj.pesoMeta ?? sug.pesoCalculo;
  const calorico = computeProtocoloCalorico({
    ffm: sug.caloricoInputs.ffm,
    pesoN: pesoEfectivo,
    talla: sug.caloricoInputs.talla,
    edad: sug.caloricoInputs.edad,
    sexoM: sug.caloricoInputs.sexoM,
    deficit: sug.estrategia.deficit,
    protMin: sug.protMin,
    geb: adj.geb ?? undefined,
    pal: adj.pal ?? undefined,
    kcalObj: adj.kcalObj ?? undefined,
    protGkg: adj.protGkg ?? undefined,
    fatPct: adj.fatPct ?? undefined,
  });
  return { pesoEfectivo, calorico };
}
