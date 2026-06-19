import { Badge } from "@/components/ui/badge";

import type { AssignmentStatus, DeviceStatus } from "../types";

// Etiquetas en espanol de los estados (la BD guarda los enums en ingles).
export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  available: "Disponible",
  in_use: "En uso",
  maintenance: "Mantenimiento",
  out_of_service: "Fuera de servicio",
  lost: "Perdido",
  retired: "Retirado",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  active: "Activo",
  completed: "Completado",
  breach: "Incumplimiento",
};

export const DEVICE_STATUS_OPTIONS: DeviceStatus[] = [
  "available",
  "in_use",
  "maintenance",
  "out_of_service",
  "lost",
  "retired",
];

// Tinte por estado de equipo. El comodato no es riesgo clinico, asi que se usan
// neutros/semanticos suaves, no la capa clinica.
const DEVICE_TINT: Record<DeviceStatus, string> = {
  available: "bg-clinical-optimal-bg text-clinical-optimal",
  in_use: "bg-blue-50 text-primary",
  maintenance: "bg-clinical-warning-bg text-clinical-warning",
  out_of_service: "bg-muted text-muted-foreground",
  lost: "bg-clinical-critical-bg text-clinical-critical",
  retired: "bg-muted text-muted-foreground",
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Badge variant="outline" className={DEVICE_TINT[status]}>
      {DEVICE_STATUS_LABELS[status]}
    </Badge>
  );
}

const ASSIGNMENT_TINT: Record<AssignmentStatus, string> = {
  active: "bg-blue-50 text-primary",
  completed: "bg-muted text-muted-foreground",
  breach: "bg-clinical-critical-bg text-clinical-critical",
};

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <Badge variant="outline" className={ASSIGNMENT_TINT[status]}>
      {ASSIGNMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
