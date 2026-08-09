// Tipo NEUTRO (sin server-only) de la banda de EB-BIS que la ReportCard necesita para la superficie de
// confirmacion de "empeoro". Vive aparte del reader server-only para que la card cliente lo importe sin
// arrastrar el reader al boundary de cliente (hazard RSC latente; ver client-import-server-only-rompe-prod).
// El reader lo reexporta para el server. null si el reporte no tiene banda sellada (inicial o sin previa
// comparable). proximaCita se trae solo cuando band = 'empeoro' (es el gate); prefill del input.
export type TrajectoryConfirmation = {
  band: "mejoro" | "sin_cambio" | "empeoro";
  ebDelta: number;
  provisional: boolean;
  communicated: boolean; // ya confirmada (trajectory_communicated_at no null)
  proximaCita: string | null; // fecha ya agendada en el tratamiento, para prefill del input
};
