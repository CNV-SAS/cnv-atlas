// Etiquetas de UI del flujo de grants (puras, compartidas por las pantallas).

export const GRANT_TYPE_LABEL: Record<string, string> = {
  notes_pseudonymous: "Seudonimizado",
  notes_identified: "Identificado",
};

export const GRANT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  denied: "Negado",
  revoked: "Revocado",
};

export const REASON_CATEGORY_LABEL: Record<string, string> = {
  auditoria_calidad: "Auditoria de calidad",
  soporte_tecnico: "Soporte tecnico",
};
