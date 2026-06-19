import { z } from "zod";

// Validaciones del comodato. Toda entrada externa pasa por Zod con limites de
// tamano. Las fechas viajan como ISO (YYYY-MM-DD), el formato de las columnas date.

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha valida (YYYY-MM-DD).");

export const deviceStatusEnum = z.enum([
  "available",
  "in_use",
  "maintenance",
  "out_of_service",
  "lost",
  "retired",
]);

// Crear equipo. asset_code, manufacturer_serial y system_email son unicos en BD.
export const createDeviceSchema = z.object({
  assetCode: z.string().trim().min(1).max(60),
  manufacturerSerial: z.string().trim().min(1).max(120),
  systemEmail: z.string().trim().email().max(160),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().min(1).max(120),
  supplier: z.string().trim().max(120).optional(),
  purchaseDate: isoDate.optional(),
  lastCalibrationDate: isoDate.optional(),
});
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;

// El estado del equipo se gestiona aparte del contrato (no se acoplan al asignar).
export const updateDeviceStatusSchema = z.object({
  deviceId: z.string().uuid(),
  status: deviceStatusEnum,
});
export type UpdateDeviceStatusInput = z.infer<typeof updateDeviceStatusSchema>;

// Asignar comodato. expected_end_date no puede ser anterior a start_date.
export const assignComodatoSchema = z
  .object({
    deviceId: z.string().uuid(),
    professionalId: z.string().uuid(),
    startDate: isoDate,
    expectedEndDate: isoDate,
  })
  .refine((d) => d.expectedEndDate >= d.startDate, {
    message: "La fecha de fin no puede ser anterior a la de inicio.",
    path: ["expectedEndDate"],
  });
export type AssignComodatoInput = z.infer<typeof assignComodatoSchema>;

// Registrar devolucion. Cierra el contrato (completed) o lo marca en incumplimiento.
export const returnComodatoSchema = z.object({
  assignmentId: z.string().uuid(),
  actualReturnDate: isoDate,
  status: z.enum(["completed", "breach"]).default("completed"),
});
export type ReturnComodatoInput = z.infer<typeof returnComodatoSchema>;

// Estado para los formularios de comodato (useActionState).
export type ComodatoFormState = { error: string | null; success: string | null };
