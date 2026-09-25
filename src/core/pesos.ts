// ═══ LEER UNA CIFRA EN PESOS TECLEADA POR UNA PERSONA (2026-09-25) ═══
//
// EL CASO QUE LO MOTIVA: la venta retroactiva pide el precio que tenía el producto ese día, y Santiago tecleó
// uno y la pantalla lo rechazó con "Revisa los productos, las cantidades y los precios". `Number()` sobre lo
// que la gente escribe de verdad da esto:
//
//   "11900"     -> 11900   correcto
//   "11,900"    -> NaN     rechazado, y él había escrito bien
//   "11.900"    -> 11.9    PEOR QUE EL RECHAZO: pasa la validación y registra una venta de doce pesos
//   "$11.900"   -> NaN
//
// El segundo es el que importa: un rechazo se ve y se corrige; un 11,9 que pasa queda en la contabilidad, en
// la comisión y en la liquidación, y nadie lo nota hasta que alguien cuadra las cifras.
//
// ── LA REGLA, Y POR QUE ES ESTA ──────────────────────────────────────────────────────────────────
//
// En Colombia el punto separa miles y la coma, decimales, pero la gente teclea de las dos formas. Lo que
// desambigua no es el símbolo, es el TAMAÑO DEL ÚLTIMO GRUPO: "11.900" y "11,900" son once mil novecientos
// (grupo de tres), y "11,5" u "11.50" son once y medio (grupo de uno o dos). Nadie escribe "11,500"
// queriendo decir once con quinientas milésimas.
//
// Lo que NO se puede leer con certeza se devuelve como null y quien llama lo dice. Adivinar aquí es escribir
// una cifra de dinero que nadie tecleó.

/** Una cifra en pesos tal como la teclea una persona, o null si no se puede leer con certeza. */
export function pesosDeTexto(valor: string): number | null {
  // Fuera lo que acompaña a una cifra sin ser parte de ella: el símbolo, los espacios (incluido el fino que
  // pegan algunas hojas de cálculo) y el rótulo de la moneda.
  const limpio = valor
    .replace(/\s| | /g, "")
    .replace(/\$/g, "")
    .replace(/cop/gi, "");
  if (limpio === "") return null;
  if (!/^\d[\d.,]*$/.test(limpio)) return null;

  const separadores = limpio.match(/[.,]/g) ?? [];
  if (separadores.length === 0) return Number(limpio);

  const ultimo = Math.max(limpio.lastIndexOf("."), limpio.lastIndexOf(","));
  const decimales = limpio.length - ultimo - 1;
  // Grupo de TRES = separador de miles; de uno o dos = decimales. Con varios separadores, solo el último
  // puede ser decimal y los anteriores son de miles (y entonces el último grupo de tres también lo es).
  const ultimoEsDecimal = decimales !== 3 || separadores.length > 1 ? decimales !== 3 : false;

  if (!ultimoEsDecimal) {
    const soloDigitos = limpio.replace(/[.,]/g, "");
    return /^\d+$/.test(soloDigitos) ? Number(soloDigitos) : null;
  }
  // Los decimales no son 3: el último separador los abre y todo lo anterior son miles.
  const enteros = limpio.slice(0, ultimo).replace(/[.,]/g, "");
  const resto = limpio.slice(ultimo + 1);
  if (!/^\d+$/.test(enteros) || !/^\d+$/.test(resto)) return null;
  return Number(`${enteros}.${resto}`);
}

/** Una cantidad entera tecleada por una persona, o null si no se puede leer. */
export function enteroDeTexto(valor: string): number | null {
  const n = pesosDeTexto(valor);
  return n != null && Number.isInteger(n) ? n : null;
}
