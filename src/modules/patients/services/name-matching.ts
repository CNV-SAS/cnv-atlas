// Comparacion de nombres para detectar posibles duplicados. Funciones puras y
// deterministas (testables sin BD). No se usan para mostrar, solo para medir
// parecido; la decision final siempre la toma el profesional.

// Normaliza un nombre: minusculas, sin acentos, sin signos, espacios colapsados.
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // quita acentos y dieresis (marcas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // signos fuera
    .replace(/\s+/g, " ")
    .trim();
}

// Distancia de edicion de Levenshtein entre dos cadenas.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Similitud 0..1 entre dos nombres ya normalizados: 1 = identicos, 0 = sin parecido.
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}
