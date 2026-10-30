// Datos del model-registry DERIVADOS de la ciencia congelada (B11, ST5). Genera los
// catalogos del modelo (indicadores, fenotipos estructurales, sectores FyR y los 81
// estados EFR) a partir del motor de Gildardo, para poblarlos en BD sin transcribir a
// mano. La taxonomia real manda sobre los docs viejos (F1-F12/PBI/EIEC no aplican).
//
// TS puro; consume la ciencia congelada (frozen/) via el adaptador de tipos.

// Derivado: engine.core.js + 6 exports aditivos (efrProf, clasificadores). Mecanismo de archivo
// derivado, no edita el frozen (ver engine.core.derived.js y DIFF C).
import * as core from "./frozen/engine.core.derived.js";
import { bandToLetter, efrStateNumber, INDICATOR_CODES } from "./types";

export type IndicatorDef = { code: string; name: string; unit: string | null };
export type PhenotypeDef = { code: string; name: string }; // estructural (STRUCT, 9)
export type FrSectorDef = { code: string; name: string }; // sector FyR (FYR, 9)
export type EfrStateDef = {
  stateNumber: number; // 1..81
  ifcBand: number;
  ircBand: number;
  ffmiBand: number;
  fmiBand: number;
  key: string; // IFC_IRC_FFMI_FMI (letras A/N/B)
  diagnosisName: string;
  mechanism: string;
  biomarkers: string;
  risks: string;
  suggestedNutraceuticals: string;
};

// Nombres de los 12 indicadores (documentales; los codigos y la ciencia son la fuente de
// verdad). Orden = INDICATOR_CODES del contrato.
const INDICATOR_NAMES: Record<string, { name: string; unit: string | null }> = {
  // Nombres FIJADOS por Gildardo (§10, RESPUESTA_GILDARDO_2026-08-09): uno solo por indicador, en todas
  // las vistas. Se descartan las variantes viejas (Funcionalidad, Universal, Espectro, y el sufijo "(BIS)"
  // de ISCM). IRC y ICA-BIS no cambian. Al cambiar aqui hay que RESEMBRAR indicator_definitions en los
  // dos entornos (local y nube): el nombre se muestra desde la BD, no desde este archivo.
  IFC: { name: "Índice de Función Celular", unit: null },
  IRC: { name: "Índice de Riesgo Celular", unit: null },
  PABU: { name: "Proporción Áurea Bioeléctrica de Uribe", unit: null },
  "ICA-BIS": { name: "Índice de Coherencia Áurea (BIS)", unit: null },
  ISCM: { name: "Índice de Susceptibilidad Cardiometabólica", unit: null },
  IEHH: { name: "Índice del Estado de Hidratación Humana", unit: null },
  IAE: { name: "Índice de Aceleración del Envejecimiento", unit: "años" },
  // ═══ SU TABLA 3 DEL 2026-10-26 RETIRA LA DIVERGENCIA D-010/D-011 (Santiago, 2026-10-30) ═══
  //
  // Decia "Edad Bioeléctrica (EB-BIS)", y eso NO era un rotulo nuestro: salia de su tercera ronda del
  // 2026-07-30, donde decidio *"el indicador se llama EB-BIS, Edad Bioeléctrica"* y, mas fuerte, *"la
  // expresion 'edad biologica' no se usa en ningun contenido del sistema: ni en pantalla, ni en reportes,
  // ni en documentos cientificos"*, nombrando expresamente la pantalla de resultados de Atlas. Quedo
  // registrado como divergencia deliberada (A9 de COTEJOS_VISUALES, D-010/D-011).
  //
  // SU TABLA 3 DEL 2026-10-26 LO REVIERTE, y lo revierte EL: las dos filas de la EB-BIS y del IAE dicen
  // "Profesional y paciente" y la frase que escribe es *"Edad biologica estimada: 76,4 años"*. O sea que
  // vuelve a usar la expresion, ahora con "estimada", que es justo el matiz que su objecion pedia (lo que
  // le molestaba era afirmar la edad del cuerpo, no estimarla). Lo nuevo manda y es mas especifico, igual
  // que la tabla 3 mando sobre el "Concordante" de su capa de display vieja el 29 de octubre.
  //
  // LA SIGLA NO SE PIERDE, que era el fondo de su decision del 30 de julio: la fila pinta "EB-BIS" como
  // etiqueta y este nombre al lado, asi que se lee "EB-BIS · Edad biológica estimada".
  EB: { name: "Edad biológica estimada", unit: "años" },
  FMI: { name: "Índice de Masa Grasa", unit: "kg/m2" },
  FFMI: { name: "Índice de Masa Libre de Grasa", unit: "kg/m2" },
  AF: { name: "Ángulo de Fase a 50 kHz", unit: "grados" },
  IR: { name: "Radio de impedancia", unit: null },
};

export function buildIndicatorDefs(): IndicatorDef[] {
  return INDICATOR_CODES.map((code) => ({
    code,
    name: INDICATOR_NAMES[code].name,
    unit: INDICATOR_NAMES[code].unit,
  }));
}

// Fenotipos estructurales (STRUCT_LABELS: FFMI x FMI, 9). code = clave "A_B", etc.
export function buildPhenotypeDefs(): PhenotypeDef[] {
  return Object.entries(core.STRUCT_LABELS).map(([code, name]) => ({ code, name }));
}

// Sectores funcionales FyR (FYR_LABELS: IFC x IRC, 9). code = clave "3_1", etc.
export function buildFrSectorDefs(): FrSectorDef[] {
  return Object.entries(core.FYR_LABELS).map(([code, v]) => ({ code, name: v.l }));
}

// Los 81 estados EFR: se corre el motor congelado (getDX) para cada combinacion de las 4
// bandas (cada una 1/2/3). El contenido (diagnostico/mecanismo/biomarcadores/riesgos/
// nutraceuticos) es verbatim del mapa DX + efrCompose de Gildardo.
export function buildEfrStates(): EfrStateDef[] {
  const out: EfrStateDef[] = [];
  for (let ifc = 1; ifc <= 3; ifc++) {
    for (let irc = 1; irc <= 3; irc++) {
      for (let ffmi = 1; ffmi <= 3; ffmi++) {
        for (let fmi = 1; fmi <= 3; fmi++) {
          const dx = core.getDX(ifc, irc, ffmi, fmi);
          const key = `${bandToLetter(ifc)}_${bandToLetter(irc)}_${bandToLetter(ffmi)}_${bandToLetter(fmi)}`;
          out.push({
            stateNumber: efrStateNumber({ ifc, irc, ffmi, fmi }),
            ifcBand: ifc,
            ircBand: irc,
            ffmiBand: ffmi,
            fmiBand: fmi,
            key,
            diagnosisName: String(dx.dx ?? dx.name ?? key),
            mechanism: String(dx.mec ?? ""),
            biomarkers: String(dx.bio ?? ""),
            risks: String(dx.rsk ?? ""),
            suggestedNutraceuticals: String(dx.n ?? ""),
          });
        }
      }
    }
  }
  return out;
}

export function buildRegistryData() {
  return {
    indicators: buildIndicatorDefs(),
    phenotypes: buildPhenotypeDefs(),
    frSectors: buildFrSectorDefs(),
    efrStates: buildEfrStates(),
  };
}
