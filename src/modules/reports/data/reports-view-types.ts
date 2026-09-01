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

// EL PLAN QUE RECIBE EL PACIENTE (Gildardo §7.1). Vive aqui, en el modulo NEUTRO, y no junto a su lector:
// ese es `server-only`, y un tipo compartido que viva ahi es la arista latente de siempre (un
// componente cliente que lo importe con `import type` compila verde y puede romper en produccion).

export type FilaDistribucion = { alimento: string; porTiempo: { tiempo: string; porciones: number }[] };

export type PlanPaciente = {
  /** Bloque 2 · la meta. */
  objetivoTexto: string | null;
  kcalObjetivo: number | null;
  pesoMeta: number | null;
  /** Bloque 3 · el plan dietético: el tipo de dieta y lo que prescribe el modelo. */
  tipoDieta: string | null;
  prescripcion: { nombre: string; valor: string }[];
  atributos: string[];
  notasDelModelo: string[];
  /** Bloque 4 · el ejemplo de menú: los siete días de su ciclo, con los tiempos que el paciente hace. */
  menu: { dia: string; comidas: { tiempo: string; texto: string }[] }[];
  /** Bloque 5 · la distribución por porciones. */
  tiemposActivos: string[];
  distribucion: FilaDistribucion[];
  /** Bloque 6 · las recomendaciones que aplican a su caso. */
  recomendaciones: { titulo: string; lineas: string[] }[];
};
