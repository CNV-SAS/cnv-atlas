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
