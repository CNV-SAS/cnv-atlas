// EDAD EN UNA FECHA. Modulo NEUTRO (sin `server-only`) a proposito: lo necesitan el encabezado de la
// historia clinica y la tarjeta de capacitancia del seguimiento, y una funcion compartida por dos capas no
// puede vivir dentro de un reader `server-only`.
//
// La fecha de nacimiento es una columna `date`, sin hora ni zona. Se compara en UTC y NO se convierte a la
// zona de Colombia: convertir una fecha PURA la retrocede un dia, que es un error de categoria (el helper
// de zona es correcto para un `timestamptz` y es justo lo que rompe una `date`).

export function edadEnFecha(birthDate: string | null, enFecha: string): number | null {
  if (!birthDate) return null;
  const n = new Date(birthDate);
  const f = new Date(enFecha);
  if (Number.isNaN(n.getTime()) || Number.isNaN(f.getTime())) return null;
  let edad = f.getUTCFullYear() - n.getUTCFullYear();
  const mes = f.getUTCMonth() - n.getUTCMonth();
  if (mes < 0 || (mes === 0 && f.getUTCDate() < n.getUTCDate())) edad -= 1;
  return edad >= 0 ? edad : null;
}
