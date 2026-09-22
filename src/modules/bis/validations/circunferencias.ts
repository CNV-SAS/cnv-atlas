import { z } from "zod";

import { esCircunferenciaValida } from "../services/circunferencias-tecleadas";

// La cintura y la cadera tecleadas (solo consultas importadas del HTML). Rangos GENEROSOS, el mismo criterio
// del import del XLSX: atrapan un decimal perdido o un ratio colado en el campo, no rechazan a un paciente.
const circunferencia = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : Number(s.replace(",", "."))))
  .refine((n) => n == null || esCircunferenciaValida(n), {
    message: "Escribe la medida en centímetros (entre 21 y 249).",
  });

export const circunferenciasSchema = z
  .object({ cintura: circunferencia, cadera: circunferencia })
  .refine((v) => v.cintura != null || v.cadera != null, {
    message: "Escribe al menos una de las dos medidas.",
  });
