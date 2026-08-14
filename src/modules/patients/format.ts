// Helpers de presentacion de pacientes (puros, sin BD). Se comparten entre el roster
// y el detalle para no duplicar el calculo de edad ni el formato de fecha.

// Edad en anos cumplidos desde la fecha de nacimiento. Null si no hay fecha o es invalida.
export function edadEnAnios(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const nacimiento = new Date(birthDate);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let anos = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) anos -= 1;
  return anos < 0 ? null : anos;
}

// Fecha corta legible en es-CO (ej. "22 jun 2026"). Delega en el helper unico (zona fija Bogota).
export { formatDateShort as fechaCorta } from "@/lib/format/date";
