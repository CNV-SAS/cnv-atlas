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
  /**
   * LO QUE EL PACIENTE NO PUEDE COMER, anadido por su profesional (`treatments.restricciones`). Las del
   * MODELO no se repiten aqui: ya salen en el bloque del plan dietetico, con su cifra.
   *
   * Su §7.1 no las nombra, y va declarado: un plan sin las restricciones es un plan que el paciente no
   * puede seguir, porque el menu que recibe puede contradecirlas.
   */
  restricciones: string[];
  /** Bloque 7 · la lista de intercambio, recortada a la región del paciente. */
  listaIntercambio: ListaIntercambioPlan;
};

/**
 * BLOQUE 7 DEL PLAN · la lista de intercambio recortada por region (su entrega del 2026-09-03).
 *
 * Su §7.1, literal: "la lista de intercambio, no la lista completa, sino los alimentos principales por
 * region o ciudad". Es el septimo de los siete bloques, y el unico que faltaba: hasta ahora `INTER_TABLA_B`
 * era nacional y no existia el mapa de que alimentos corresponden a cada region.
 *
 * NUNCA ES `null`. Una ciudad sin region NO deja al paciente sin lista: recibe la NACIONAL entera, que es
 * la regla suya ("mas vale una lista larga que una lista a la que le falte lo que la persona come"). Eso
 * se distingue mirando `region`, que es lo unico que va en null.
 */
export type ListaIntercambioPlan = {
  /** La ciudad del paciente, tal como esta en su perfil. `null` si no la tiene. */
  ciudad: string | null;
  /** El nombre legible de la region ("Cundiboyacense"), no la clave. `null` si la ciudad no resuelve. */
  region: string | null;
  /** Cuantos alimentos recibe y de cuantos, que es lo que el muestra encima de la lista. */
  total: number;
  deTotal: number;
  grupos: {
    nombre: string;
    subgrupos: {
      sub: string;
      /** Ya formateados "nombre (N g)", maximo ocho, que es el corte de su render. */
      alimentos: string[];
      /** Habia mas de ocho: su lista lo dice con ", entre otros". */
      hayMas: boolean;
    }[];
  }[];
};

// LA HISTORIA CLINICA COMO DATO, para el PDF que se le adjunta al paciente.
//
// Vive en el modulo NEUTRO por la misma razon que `PlanPaciente`: su lector es `server-only`, y un tipo
// compartido que viva ahi es la arista latente de siempre (un componente cliente que lo importe con
// `import type` compila verde y puede romper en produccion).
export type HcAutorizacionDoc = { tipo: string; vigente: boolean; revocada: boolean };
export type HcRemisionDoc = { profesion: string; motivo: string | null; estado: string; fecha: string };
export type HcObservacionDoc = {
  texto: string;
  autor: string | null;
  profesion: string | null;
  fecha: string;
};

export type HcIndiceDoc = {
  codigo: string;
  nombre: string;
  valor: string | null;
  clasificacion: string | null;
  referencia: string | null;
  severidad: number | null;
};

export type HistoriaClinicaDoc = {
  paciente: string;
  /** Resumen diagnostico del NUTRICIONISTA (su §11c). null si el DFI no esta completo. */
  resumenProfesional: string | null;
  /** El DFI redactado como parrafo. null si el DFI no esta completo. */
  dfiParrafo: string | null;
  /** Meta terapeutica de nutricion, de las rutas activas. */
  metaTerapeutica: string | null;
  /** POR QUE no se pudieron emitir los tres de arriba. Un bloque ausente sin explicacion, en un documento
   *  probatorio, se lee como que no se evaluo. */
  motivoSinNarrativa: string | null;
  /** Indices ANI BIS-E alterados, con su referencia y su severidad. */
  indices: HcIndiceDoc[];
  /** Rutas de atencion activadas por el diagnostico. */
  rutas: { label: string; activacion: string | null }[];
  /** Composicion corporal del equipo, con su clasificacion. Peso y talla van arriba, en los datos. */
  composicion: { etiqueta: string; valor: string; clasificacion: string | null }[];
  edad: number | null;
  sexo: string | null;
  pesoKg: number | null;
  tallaCm: number | null;
  fechaConsulta: string;
  profesional: string;
  motivos: string[];
  antecedentes: { grupo: string; items: string[] }[];
  objetivoTratamiento: string | null;
  plan: HcPlanNutricionalDoc | null;
  /** Cifras prescritas fuera de lo que sugiere el diagnostico (P-109). Vacio = no hubo o no se comparo. */
  desviaciones: { macro: string; cifra: string; texto: string }[];
  recomendaciones: { titulo: string; items: string[]; pendiente?: boolean }[];
  remisiones: HcRemisionDoc[];
  observaciones: HcObservacionDoc[];
  proximaCita: string | null;
  /** Version del consentimiento CON QUE SE CAPTURO ESTA CONSULTA, no la vigente hoy. */
  consentVersion: string | null;
  autorizaciones: HcAutorizacionDoc[];
};

export type HcPlanNutricionalDoc = {
  geb: number | null;
  get: number | null;
  kcalObjetivo: number | null;
  proteinaG: number | null;
  proteinaGKg: number | null;
  carbohidratosG: number | null;
  grasasG: number | null;
  /** El % que FIJA el profesional; los gramos son su consecuencia (su punto 9 del 3-sep). */
  grasasPct: number | null;
  actividadFisica: string | null;
  sodioMax?: number | null;
};
