// Formato de fechas en zona horaria FIJA de Colombia (America/Bogota). Fuente unica: sin una zona
// explicita, toLocale* usa la zona del runtime, que en el servidor (Vercel, UTC) difiere de la del
// navegador (Colombia, UTC-5). Eso causaba DOS defectos: (1) la fecha se mostraba en hora de Londres
// en las superficies renderizadas en servidor, y (2) en componentes cliente el string del servidor y
// el del cliente no coincidian, disparando el error de hidratacion de React (418). Fijar la zona hace
// la salida DETERMINISTA e igual en los dos lados. Todo formato de fecha de la app pasa por aqui, asi
// el proximo sitio no depende de acordarse de la zona.

const BOGOTA = "America/Bogota";

function toDate(iso: string | number | Date): Date {
  return iso instanceof Date ? iso : new Date(iso);
}

// dd/mm/aaaa (zona Bogota). Si la fecha es invalida, devuelve el insumo tal cual (string) o "".
export function formatDate(iso: string | number | Date | null | undefined): string {
  if (iso == null) return "";
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return d.toLocaleDateString("es-CO", { timeZone: BOGOTA });
}

// Fecha + hora (zona Bogota).
export function formatDateTime(iso: string | number | Date | null | undefined): string {
  if (iso == null) return "";
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return d.toLocaleString("es-CO", { timeZone: BOGOTA });
}

// Fecha corta legible: "22 jun 2026" (zona Bogota).
export function formatDateShort(iso: string | number | Date | null | undefined): string {
  if (iso == null) return "";
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return d.toLocaleDateString("es-CO", {
    timeZone: BOGOTA,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Fecha larga: "12 de agosto de 2026" (zona Bogota).
export function formatDateLong(iso: string | number | Date | null | undefined): string {
  if (iso == null) return "";
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return d.toLocaleDateString("es-CO", {
    timeZone: BOGOTA,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// FECHAS PURAS (columnas `date`: proxima_cita, referred_at, returned_at, birth_date, comodato...).
//
// NO PASAN por las funciones de arriba, y esto es un defecto real, no una preferencia: `new Date("2026-09-04")`
// se parsea como MEDIANOCHE UTC, y convertirlo a America/Bogota (UTC-5) da el 3 de septiembre a las 19:00,
// asi que la fecha SE MUESTRA UN DIA ANTES. Le paso a la proxima cita en la historia clinica (smoke
// 2026-08-25: se agendo el 4/9 y salia 3/9).
//
// La causa de fondo: una columna `date` NO ES UN INSTANTE. No tiene hora ni zona, asi que convertirla a
// cualquier zona es un error de categoria. Fijar la zona (que es lo correcto para un timestamp) es
// justamente lo que la rompe.
//
// Aqui se leen los componentes del texto y se formatean tal cual, sin construir un Date intermedio.
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** dd/mm/aaaa de una fecha PURA (YYYY-MM-DD). Sin conversion de zona. */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso; // no es una fecha pura: se devuelve tal cual antes que mentir
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** "4 sep 2026" de una fecha PURA. Sin conversion de zona. */
export function formatDateOnlyShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = MESES_CORTOS[Number(m[2]) - 1];
  if (!mes) return iso;
  return `${Number(m[3])} ${mes} ${m[1]}`;
}
