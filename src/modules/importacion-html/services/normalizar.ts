// EL CRUCE POR DOCUMENTO (revision de Claude web, 2026-09-22, ajuste c). En el HTML el documento se tecleo a
// mano, asi que puede venir con puntos, espacios, guiones o ceros de mas. Comparar el texto tal cual crearia
// un paciente duplicado. Se normaliza antes de comparar; y si solo hay PARECIDO, no se decide: se muestra.

/** Sin puntos, espacios, guiones ni ceros a la izquierda, en mayusculas. "1.040.742.568" y "01040742568" son el mismo. */
export function normalizarDocumento(doc: string): string {
  const limpio = doc.normalize("NFKC").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return /^\d+$/.test(limpio) ? limpio.replace(/^0+(?=\d)/, "") : limpio;
}

/** El nombre para comparar: sin tildes, en minusculas y con un solo espacio. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Difieren en a lo sumo un caracter (uno cambiado, uno de mas o uno de menos)? */
export function difierenEnUno(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let diferencias = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    diferencias++;
    if (diferencias > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return diferencias + (a.length - i) + (b.length - j) <= 1;
}
