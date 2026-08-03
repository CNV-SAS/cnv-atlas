import "server-only";

import { desc, eq } from "drizzle-orm";

import { ENGINE_VERSION } from "@/clinical-engine";
import { db } from "@/db";
import { diagnoses, reports, treatmentDietGuidelines, treatmentNotes, treatmentNutraceuticals, treatments } from "@/db/schema";
import { buildEmissionVersions, EMISSION_VERSION_KEYS } from "@/modules/clinical-pipeline/emission-versions";

// Calcula los avisos CONDICIONALES de la confirmación de corrección (S2): lo que se pierde y lo que
// puede cambiar. La lista honesta, específica de ESTA evaluación. Vacía si no hay nada que advertir.
// Todo por el db owner (lectura del profesional gobernada aguas arriba por la página).

const DIM_LABEL: Record<string, string> = {
  classification: "los clasificadores",
  calibration: "la calibración de la edad bioeléctrica",
  structural_mccb: "el clasificador de fenotipo",
};

export async function getCorrectionWarnings(evaluationId: string): Promise<string[]> {
  const warnings: string[] = [];

  const [diag] = await db
    .select({ id: diagnoses.id, engineVersion: diagnoses.engineVersion, emissionVersions: diagnoses.emissionVersions })
    .from(diagnoses)
    .where(eq(diagnoses.evaluationId, evaluationId))
    .orderBy(desc(diagnoses.createdAt))
    .limit(1);
  if (!diag) return warnings; // sin diagnóstico no hay nada que rehacer

  const [t] = await db
    .select({
      id: treatments.id,
      status: treatments.status,
      adjGeb: treatments.adjGeb,
      adjPal: treatments.adjPal,
      adjKcalObj: treatments.adjKcalObj,
      adjProtGkg: treatments.adjProtGkg,
      adjFatPct: treatments.adjFatPct,
      adjPesoMeta: treatments.adjPesoMeta,
      micronutrientes: treatments.micronutrientesTexto,
      proximaCita: treatments.proximaCita,
    })
    .from(treatments)
    .where(eq(treatments.diagnosisId, diag.id))
    .orderBy(desc(treatments.createdAt))
    .limit(1);

  // 1. Pérdidas del tratamiento (específicas: solo lo que ESE tratamiento tiene).
  if (t) {
    const adjCount = [t.adjGeb, t.adjPal, t.adjKcalObj, t.adjProtGkg, t.adjFatPct, t.adjPesoMeta].filter((v) => v != null).length;
    const [notes, guides, nutra] = await Promise.all([
      db.select({ id: treatmentNotes.id }).from(treatmentNotes).where(eq(treatmentNotes.treatmentId, t.id)),
      db.select({ id: treatmentDietGuidelines.id }).from(treatmentDietGuidelines).where(eq(treatmentDietGuidelines.treatmentId, t.id)),
      db.select({ id: treatmentNutraceuticals.id }).from(treatmentNutraceuticals).where(eq(treatmentNutraceuticals.treatmentId, t.id)),
    ]);
    const notesCount = notes.length;
    const guidesCount = guides.length;
    const nutraCount = nutra.length;

    const perdidas: string[] = [];
    if (adjCount) perdidas.push(`${adjCount} ajuste${adjCount > 1 ? "s" : ""} de objetivos`);
    if (notesCount) perdidas.push(`${notesCount} nota${notesCount > 1 ? "s" : ""}`);
    if (guidesCount) perdidas.push(`${guidesCount} guía${guidesCount > 1 ? "s" : ""}`);
    if (nutraCount) perdidas.push(`${nutraCount} nutracéutico${nutraCount > 1 ? "s" : ""} agregado${nutraCount > 1 ? "s" : ""}`);
    if (t.micronutrientes?.trim()) perdidas.push("las notas de micronutrientes");
    if (t.proximaCita) perdidas.push("la próxima cita");
    if (perdidas.length) {
      warnings.push(`Vas a perder ${perdidas.join(", ")} del tratamiento actual: se genera de nuevo con el diagnóstico corregido.`);
    }

    // 2. Aprobación invalidada.
    if (t.status === "approved") {
      warnings.push("La aprobación del protocolo se invalida; habrá que aprobar el nuevo.");
    }
  }

  // 3. Reporte enviado (sent_at confiable: se marca solo tras el envío OK; "se envió", no "lo tiene").
  const [rep] = await db
    .select({ sentAt: reports.sentAt })
    .from(reports)
    .where(eq(reports.evaluationId, evaluationId))
    .orderBy(desc(reports.createdAt))
    .limit(1);
  if (rep?.sentAt) {
    warnings.push("El reporte ya se le envió al paciente por correo; la corrección genera uno nuevo (el paciente tiene el anterior).");
  }

  // 4. El modelo puede haber cambiado entremedio: nombra QUÉ dimensión difiere (concreto, no genérico).
  const current = buildEmissionVersions();
  const old = (diag.emissionVersions ?? {}) as Record<string, string>;
  const changedDims: string[] = [];
  if (diag.engineVersion !== ENGINE_VERSION) changedDims.push("el motor");
  for (const k of EMISSION_VERSION_KEYS) {
    if (old[k] && old[k] !== current[k] && DIM_LABEL[k]) changedDims.push(DIM_LABEL[k]);
  }
  if (changedDims.length) {
    warnings.push(
      `El diagnóstico se recalcula con la versión vigente del modelo, que cambió desde este diagnóstico (${changedDims.join(", ")}); además del dato que corriges, algunas clasificaciones pueden diferir.`,
    );
  }

  return warnings;
}
