// SEPARADOR DECIMAL EN SUPERFICIES QUE VE UN PROFESIONAL.
//
// Nace del cotejo visual del 2026-08-27. En la pantalla de Diagnostico convivian los dos separadores
// a centimetros de distancia: las tarjetas del DFI traen las cadenas del motor, que Gildardo formatea
// en español ("IFC 6,98"), y nuestra capa de presentacion formateaba con `toFixed`, que es el default
// de JavaScript y usa punto ("corte: optima >6.68", "Δ 0.30"). El mismo renglon decia 6,98 y 6.68.
//
// Regla de CLAUDE.md: español correcto en TODO lo que ve un usuario. La coma no es cosmetica aqui;
// media correccion (una tabla en coma y la de al lado en punto) se lee como sistema mal terminado.
//
// AMBITO: solo el TEXTO que se muestra. NO usar para coordenadas SVG, ids, claves ni nada que se
// parsee despues: ahi el punto es lo correcto y cambiarlo rompe.

/** Numero -> texto en español (coma decimal). `dec` decimales; los enteros salen sin decimales. */
export function fmtDec(v: number, dec = 2): string {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(dec);
  return s.replace(".", ",");
}

/** Cambia el punto decimal por coma en una cadena ya armada (rangos como "4.12-6.68" -> "4,12-6,68"). */
export function decimalesEsp(s: string): string {
  return s.replace(/(\d)\.(\d)/g, "$1,$2");
}
