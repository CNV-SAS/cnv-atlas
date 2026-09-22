// ═══ LA CINTURA Y LA CADERA TECLEADAS, Y LO QUE ARRASTRAN (2026-09-22) ═══
//
// Solo para el paciente IMPORTADO del HTML: su tamizaje fue hace meses y no se puede repetir (decision de
// Santiago). Para el paciente que esta delante, con el equipo, la regla sigue siendo volver a medir.
//
// Y NO BASTA CON GUARDARLAS: el ICC y el ICT que Atlas muestra salen del export del equipo, asi que teclear
// la cadera dejaria los dos indices con el valor viejo (o vacios). Su HTML los RECALCULA desde lo tecleado
// (v9 L7154-7155: `ICC = cintura / cadera`, `ICT = cintura / tallaCm`, a tres decimales), y eso es lo que se
// hace aqui: la formula es suya, no nuestra.
//
// PURO: recibe lo que hay y devuelve las filas a guardar. El escritor solo las persiste.

/** `atlasCirc` del HTML (v9 L731): una circunferencia de 20 cm o menos es un ratio colado, no una medida. */
export function esCircunferenciaValida(valor: number): boolean {
  return Number.isFinite(valor) && valor > 20 && valor < 250;
}

const tresDecimales = (v: number): number => parseFloat(v.toFixed(3));

export type FilaDeMedicion = { variableName: string; value: number };

/**
 * Las filas a guardar cuando el profesional teclea la cintura o la cadera de una consulta importada: las dos
 * circunferencias y los indices que dependen de ellas.
 *
 * `talla` en cm. Si falta alguno de los insumos, el indice correspondiente no se escribe: el HTML tampoco lo
 * calcula (su expresion exige las dos partes).
 */
export function filasDeCircunferencias(entrada: {
  cintura: number | null;
  cadera: number | null;
  talla: number | null;
  headers: { cintura: string; cadera: string; icc: string; ict: string };
}): FilaDeMedicion[] {
  const { cintura, cadera, talla, headers } = entrada;
  const filas: FilaDeMedicion[] = [];
  if (cintura != null) filas.push({ variableName: headers.cintura, value: cintura });
  if (cadera != null) filas.push({ variableName: headers.cadera, value: cadera });
  if (cintura != null && cadera != null && cadera > 0) {
    filas.push({ variableName: headers.icc, value: tresDecimales(cintura / cadera) });
  }
  if (cintura != null && talla != null && talla > 0) {
    filas.push({ variableName: headers.ict, value: tresDecimales(cintura / talla) });
  }
  return filas;
}
