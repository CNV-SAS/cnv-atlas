import type { Database } from "@/types/database.generated";

// Tipos de dominio del comodato, derivados de la Database generada para no
// duplicar la forma de las tablas.
type Tables = Database["public"]["Tables"];

export type Device = Tables["devices"]["Row"];
export type DeviceInsert = Tables["devices"]["Insert"];
export type DeviceAssignment = Tables["device_assignments"]["Row"];
export type DeviceAssignmentInsert = Tables["device_assignments"]["Insert"];

export type DeviceStatus = Database["public"]["Enums"]["device_status"];
export type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];

// Profesional asignable para el selector de comodato (id de professional_profiles).
export type AssignableProfessional = {
  id: string;
  fullName: string;
  email: string;
};
