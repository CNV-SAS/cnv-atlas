// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ICA-BIS, CON SIGNO, Y UNA SOLA FORMA DE LEERLO  ·  v17 §4  ·  2026-11-11
//
// ═══ EL ERROR QUE CIERRA ═══
//
// Hasta aqui el motor sellaba `icaBis = |PABU - 1,618|`, en magnitud. Su v17 lo corrige: *"ICA-BIS =
// PABU - 1,618, con signo"*, porque el valor absoluto PIERDE LA DIRECCION del alejamiento de φ, y la
// direccion es la mitad del significado:
//
//   · por ENCIMA de φ (positivo) -> deficit estructural;
//   · por DEBAJO de φ (negativo) -> exceso de adiposidad.
//
// Con el valor absoluto, un paciente con exceso de adiposidad veia una desviacion POSITIVA, que se lee
// como deficit. **Medido en la nube el 2026-11-11: le pasa a 245 de 441 consultas vigentes (55,6 %)**, o
// sea a mas de la mitad, no a un borde.
//
// ═══ POR QUE ESTO NO MUEVE NINGUN VEREDICTO, Y AUN ASI HAY QUE ARREGLARLO ═══
//
// El `icaBis` NO entra en ningun puntaje del DFI: ni en una severidad, ni en el riesgo integrado, ni en
// una ruta (esta verificado en `analysis.ts`, donde se declara su alcance). Lo que estaba mal era lo que
// se le DECIA al profesional, al paciente y a la IA. Por eso este arreglo va PRIMERO y APARTE del resto
// de la v17: corrige un dato sin tocar ninguna clasificacion.
//
// ═══ Y POR QUE NO HACE FALTA MIGRAR NADA ═══
//
// Su documento ordena recalcular los guardados conservando `ICA_BIS_v16`, y en SU aplicacion hace falta
// porque ahi el ICA-BIS es un campo almacenado que las pantallas leen. En ATLAS NO:
//
//   · un informe sellado es INMUTABLE (regla 7); la via para cambiar una cifra sellada es REEMITIR, que
//     crea una version nueva del documento. Reescribir el jsonb de un informe emitido seria cambiar lo
//     que se le entrego a una persona sin que quede rastro;
//   · y no hace falta, porque el ICA-BIS es una funcion PURA de la PABU, **y la PABU sellada ya es
//     correcta**. Asi que se DERIVA al leer, con el signo bueno, para toda consulta historica, sin tocar
//     una sola fila.
//
// Es, ademas, exactamente lo que su v17 pide: *"cuando la PABU esta disponible, toda pantalla calcula el
// ICA-BIS desde ella y no lee primero el valor guardado"*.
//
// MODULO NEUTRO Y PURO: lo leen el motor, las pantallas (cliente) y los documentos (servidor). Una sola
// definicion, porque la anterior vivia copiada en dos sitios con `Math.abs` y en tres lectores sin el.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El punto áureo. La cifra es suya y no se toca. */
export const PHI = 1.618;

/** El ICA-BIS de una PABU, CON SIGNO. `null` sin PABU: no se inventa una desviación. */
export function icaBisDeLaPabu(pabu: number | null | undefined): number | null {
  if (pabu == null || !Number.isFinite(pabu) || pabu === 0) return null;
  return Math.round((pabu - PHI) * 1e4) / 1e4;
}

/**
 * EL ICA-BIS DE UN INFORME SELLADO, con el signo bueno incluso si se sello en magnitud.
 *
 * SE PREFIERE LA PABU SELLADA sobre el `icaBis` sellado, y ese orden es el arreglo: los informes
 * anteriores a esta version llevan la magnitud, y su PABU es correcta. El `icaBis` sellado queda como
 * respaldo para el caso en que no haya PABU (no deberia pasar: sin PABU tampoco habria ICA-BIS).
 */
export function icaBisDelSello(
  indicadores: { pabu?: number | null; icaBis?: number | null } | null | undefined,
): number | null {
  if (!indicadores) return null;
  const deLaPabu = icaBisDeLaPabu(indicadores.pabu);
  if (deLaPabu != null) return deLaPabu;
  const sellado = indicadores.icaBis;
  return sellado == null || !Number.isFinite(sellado) ? null : sellado;
}
