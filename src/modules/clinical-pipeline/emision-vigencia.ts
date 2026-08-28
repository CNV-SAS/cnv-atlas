import { ENGINE_VERSION } from "@/clinical-engine";

import { buildEmissionVersions, EMISSION_VERSION_KEYS } from "./emission-versions";

// ¿ESTE documento clinico se emitio con la ciencia que rige HOY?
//
// POR QUE EXISTE. Gildardo, sobre el encendido del LE8 (2026-08-27 §3): "sobre lo ya evaluado:
// recalcular, y que quede anotado en la historia que el DFI cambio de version. Recalcular en silencio
// borra el rastro; no recalcular deja en pie diagnosticos que sabemos mal". Las DOS mitades necesitan
// saber PRIMERO cuales quedaron atras, y eso es lo que resuelve este modulo.
//
// NO ES HIPOTETICO Y YA PASO: al medirlo (2026-08-27) 23 de 40 diagnosticos seguian en
// `anibise-1.0.0` tras el bump del 19 de agosto, sin que nada lo dijera. Mas de la mitad.
//
// LO QUE ESTE MODULO NO HACE, Y ES DELIBERADO: no invalida nada, no bloquea nada y no reemite nada.
// Un documento emitido con ciencia anterior **sigue siendo valido**: se emitio correctamente con lo
// que regia entonces, y su valor probatorio no depende de que la ciencia siga igual. Marcar es
// informar, no anular. Quien decide reemitir es el profesional (y para la recalibracion poblacional,
// esa decision esta en la ronda: afecta a todos por definicion).
//
// MODULO NEUTRO (sin server-only ni "use client"): lo leen el reader del servidor y el banner del
// cliente. Es la regla de fronteras RSC de CLAUDE.md; ponerlo en un reader server-only obligaria al
// banner a importarlo cruzando el boundary.

/** Marcadores de version que un diagnostico sella. Lo que el reader saca de la fila. */
export type MarcadoresEmision = {
  engineVersion: string | null;
  emissionVersions: Record<string, unknown> | null;
};

export type DimensionDesfasada = {
  /** Clave interna de la dimension (engine, calibration, classification, structural_mccb). */
  clave: string;
  /** Con que se emitio. */
  selladoCon: string;
  /** Que rige hoy. */
  vigenteHoy: string;
};

export type VigenciaEmision = {
  /** true si TODOS los marcadores coinciden con los vigentes. */
  alDia: boolean;
  /** Las dimensiones que se movieron desde que se emitio. Vacio si `alDia`. */
  desfasadas: DimensionDesfasada[];
};

// Nombre legible de cada dimension, para el aviso al profesional. En español correcto: lo ve una
// persona. `engine` no es una clave de emission_versions (es columna aparte, regla 7), pero para el
// profesional es una dimension mas de "con que se emitio esto".
const NOMBRE: Record<string, string> = {
  engine: "motor clínico",
  classification: "clasificadores del modelo",
  calibration: "calibración de la edad bioeléctrica",
  structural_mccb: "clasificador de fenotipo MCCB",
};

export function nombreDimension(clave: string): string {
  return NOMBRE[clave] ?? clave;
}

/**
 * Compara los marcadores sellados contra los vigentes.
 *
 * UNA CLAVE AUSENTE NO CUENTA COMO DESFASE, y la distincion es de Gildardo, no nuestra: los
 * diagnosticos anteriores a que existiera `structural_mccb` no la llevan y NO se rellenan hacia
 * atras ("de aqui en adelante"; si hiciera falta en un paciente anterior, se emite una version
 * nueva). Ausente significa "no aplicaba entonces"; DISTINTO significa "la ciencia se movio". Tratar
 * el ausente como desfase marcaria documentos que nadie tiene que reemitir, y a la tercera vez el
 * profesional aprende a ignorar la marca, que es como se pierde un aviso que si importa.
 */
export function vigenciaEmision(m: MarcadoresEmision): VigenciaEmision {
  const desfasadas: DimensionDesfasada[] = [];
  const vigentes = buildEmissionVersions();

  // El motor va aparte: es columna dedicada (constelacion de la regla 7), no clave del jsonb.
  if (m.engineVersion != null && m.engineVersion !== ENGINE_VERSION) {
    desfasadas.push({
      clave: "engine",
      selladoCon: m.engineVersion,
      vigenteHoy: ENGINE_VERSION,
    });
  }

  const ev = m.emissionVersions;
  if (ev != null) {
    for (const k of EMISSION_VERSION_KEYS) {
      const sellado = ev[k];
      // Ausente => no aplicaba. Solo un valor PRESENTE y DISTINTO es desfase.
      if (typeof sellado !== "string" || sellado === "") continue;
      if (sellado !== vigentes[k]) {
        desfasadas.push({ clave: k, selladoCon: sellado, vigenteHoy: vigentes[k] });
      }
    }
  }

  return { alDia: desfasadas.length === 0, desfasadas };
}
