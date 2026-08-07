// Dias habiles en Colombia: excluye fines de semana Y festivos. Importa para plazos con consecuencia
// economica (el faltante: 5 dias habiles para justificar), donde vencer en un festivo seria injusto.
// Los festivos se COMPUTAN (no una lista que caduca): fijos + Ley Emiliani (se corren al lunes siguiente) +
// los de Semana Santa (relativos a la Pascua). Solo dias-calendario (sin hora), en hora local.

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Domingo de Pascua (algoritmo de Butcher, calendario gregoriano). Devuelve una fecha local.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Ley Emiliani: el festivo se traslada al lunes siguiente (si no cae ya en lunes).
function nextMonday(d: Date): Date {
  const r = new Date(d);
  const dow = r.getDay(); // 0 domingo .. 6 sabado; 1 lunes
  const delta = (8 - dow) % 7; // dias hasta el proximo lunes (0 si ya es lunes)
  return addDays(r, delta);
}

const _cache = new Map<number, Set<string>>();

function holidaysOf(year: number): Set<string> {
  const cached = _cache.get(year);
  if (cached) return cached;
  const set = new Set<string>();
  // Fijos (no se mueven).
  for (const [m, day] of [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]] as const) {
    set.add(ymd(new Date(year, m - 1, day)));
  }
  // Ley Emiliani (se corren al lunes siguiente).
  for (const [m, day] of [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]] as const) {
    set.add(ymd(nextMonday(new Date(year, m - 1, day))));
  }
  // Relativos a la Pascua.
  const easter = easterSunday(year);
  set.add(ymd(addDays(easter, -3))); // Jueves Santo
  set.add(ymd(addDays(easter, -2))); // Viernes Santo
  set.add(ymd(nextMonday(addDays(easter, 43)))); // Ascension del Senor (Emiliani)
  set.add(ymd(nextMonday(addDays(easter, 64)))); // Corpus Christi (Emiliani)
  set.add(ymd(nextMonday(addDays(easter, 71)))); // Sagrado Corazon (Emiliani)
  _cache.set(year, set);
  return set;
}

export function isColombianHoliday(d: Date): boolean {
  return holidaysOf(d.getFullYear()).has(ymd(d));
}

export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6 && !isColombianHoliday(d);
}

// Avanza n dias habiles desde `from` (sin contar `from`).
export function addBusinessDays(from: Date, n: number): Date {
  let d = new Date(from);
  let added = 0;
  while (added < n) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

// Dias habiles que quedan entre `from` y `to` (0 si `to` ya paso). Cuenta los dias habiles posteriores a
// `from` hasta `to` inclusive: sirve para "te quedan N dias habiles".
export function businessDaysUntil(from: Date, to: Date): number {
  if (to <= from) return 0;
  let count = 0;
  let d = new Date(from);
  while (d < to) {
    d = addDays(d, 1);
    if (d <= to && isBusinessDay(d)) count++;
  }
  return count;
}
