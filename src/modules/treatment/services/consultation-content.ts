import type { RutaComponent, RutaContent } from "@/clinical-engine/rutas-content";

// Mapeador PURO para las pestañas de consulta (médica / ejercicio). No calcula ciencia: extrae de las
// rutas ACTIVAS (ya selladas en el snapshot al diagnosticar) el componente de la especialidad que
// mira el profesional. El componente médico de las rutas trae guía clínica de QUÉ HACER (p. ej.
// "Laboratorios: PCR ultrasensible, glucemia..."), no solo "a quién remitir": por eso se trae al
// panel del médico y no solo se referencia desde la sección común de Remisiones (ajuste 3).

export type ConsultationRutaBlock = {
  rutaId: string;
  rutaLabel: string;
  urgencia: string | null; // string libre de Gildardo (p. ej. "obligatoria si HTA o DM2 activa"); NO enum
  indicaciones: string[];
};

// which = la clave del componente en RutaContent.componentes: "medico" para el médico, "ejercicio"
// para el deportólogo. Omite los componentes que no aplican o sin indicaciones.
export function professionRutaBlocks(
  which: "medico" | "ejercicio",
  rutas: RutaContent[],
): ConsultationRutaBlock[] {
  const blocks: ConsultationRutaBlock[] = [];
  for (const r of rutas) {
    const comp: RutaComponent = r.componentes[which];
    if (comp.aplica === false || comp.indicaciones.length === 0) continue;
    blocks.push({
      rutaId: r.id,
      rutaLabel: r.label,
      urgencia: comp.urgencia ?? null,
      indicaciones: comp.indicaciones,
    });
  }
  return blocks;
}
