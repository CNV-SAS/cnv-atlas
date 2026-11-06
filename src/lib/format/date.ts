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
  // UNA FECHA YA FORMATEADA SE DEVUELVE TAL CUAL (2026-09-21). El SOAP formateaba la fecha que ya le llegaba
  // formateada de la historia clinica: "10/9/2026" se leia como mes/dia (9 de octubre), la zona la corria al
  // 8, y el documento decia una fecha de consulta en el futuro. Sin error y con cara de fecha valida.
  if (typeof iso === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(iso.trim())) return iso.trim();
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return d.toLocaleDateString("es-CO", { timeZone: BOGOTA });
}

// Fecha + hora, SOLO HORA Y MINUTOS (zona Bogota): "14/9/2026, 3:23 p. m.".
//
// SIN SEGUNDOS desde el 2026-09-14 (Santiago, smoke del Bloque 3): "3:23:57" se le hace dificil de leer a un
// profesional de salud, y ningun acto clinico o comercial de la pantalla se decide por segundos. La unica
// pantalla que los conserva es el registro tecnico de auditoria (`formatDateTimeConSegundos`), donde el
// orden fino de los eventos si importa para reconstruir que paso.
export function formatDateTime(iso: string | number | Date | null | undefined): string {
  if (iso == null) return "";
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return d.toLocaleString("es-CO", {
    timeZone: BOGOTA,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Fecha + hora CON segundos: solo para el registro tecnico de auditoria. */
export function formatDateTimeConSegundos(iso: string | number | Date | null | undefined): string {
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

/**
 * d/m/aaaa de una fecha PURA (YYYY-MM-DD), sin ceros a la izquierda: el MISMO formato que `formatDate`
 * (2026-09-22). Salian dos formatos en el mismo documento ("10/9/2026" y "25/09/2026"). Sin conversion de zona.
 */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso; // no es una fecha pura: se devuelve tal cual antes que mentir
  return `${Number(m[3])}/${Number(m[2])}/${m[1]}`;
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

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * "25 de agosto de 2026" de una fecha PURA. Sin conversion de zona, por la misma razon que las dos de
 * arriba: una columna `date` no es un instante y convertirla la corre un dia.
 *
 * POR QUE EXISTE, teniendo `formatDateLong`: aquella construye un `Date` y fija la zona, que es lo
 * CORRECTO para un timestamp y lo que rompe una fecha pura. Y hace falta en letras porque las fechas que
 * lee un PACIENTE van en letras (Santiago, 2026-11-06): "25/8/2026" en un documento que se lee una vez
 * se confunde con 8 de mayo segun de donde venga quien lo lea.
 */
export function formatDateOnlyLong(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso; // no es una fecha pura: se devuelve tal cual antes que mentir
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return iso;
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}

/**
 * LA FECHA COMO LA LEE UN PACIENTE: "25 de agosto de 2026" (Santiago, 2026-11-06).
 *
 * Y AGUANTA LAS DOS FORMAS, que es la razon de que exista en vez de llamar a una de las dos de arriba:
 * las fechas de este documento vienen unas de una columna `date` (la medicion) y otras de un timestamp
 * (la creacion de la consulta). Una fecha pura NO se convierte de zona, porque convertirla la corre un
 * dia; un instante SI, porque sin zona se corre igual. Elegir mal una de las dos muestra el dia anterior,
 * que ya paso una vez con la proxima cita de la historia clinica.
 */
export function fechaParaElPaciente(iso: string | number | Date | null | undefined): string {
  if (iso == null) return "";
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10)) && iso.length <= 10
    ? formatDateOnlyLong(iso)
    : formatDateLong(iso);
}
