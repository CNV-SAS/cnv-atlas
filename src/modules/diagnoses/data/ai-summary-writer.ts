import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// EL RESUMEN DEL DIAGNOSTICO, GUARDADO. Porte del comportamiento de su archivo (2026-09-08): su
// `analisisIA` se persiste (`onUpdate({ analisisIA })`) y al volver a la pantalla se rehidrata, no se
// regenera. Nosotros igual.
//
// REEMPLAZABLE, a diferencia de `diagnosis_notes`. Y la distincion es la que estaba fundida:
//   · `diagnosis_notes` guarda el CRITERIO que un profesional escribio y ASUMIO al guardar. Append-only:
//     no se pisa, porque pisarlo seria reescribir el acto de otro.
//   · esto es la salida de una herramienta. Regenerar sustituye, porque no hay ningun acto que conservar.
//
// LA TRAZA DE CADA GENERACION NO SE PIERDE: vive en `ai_criterion_suggestions` (proveedor, modelo,
// version de prompt, texto crudo, latencia), que es inmutable. Aqui solo vive el VIGENTE.

export async function saveAiSummary(input: {
  diagnosisId: string;
  text: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const hecho = await tx
      .update(diagnoses)
      .set({ aiSummary: input.text })
      .where(eq(diagnoses.id, input.diagnosisId))
      .returning({ id: diagnoses.id });
    // Si no se escribio ninguna fila, el resumen se habria perdido en silencio y la pantalla mostraria
    // el texto devuelto por la accion como si estuviera guardado. Falla en voz alta.
    if (hecho.length === 0) throw new Error("ai-summary-writer: el diagnóstico no existe");

    // Audit inline (regla dura 8). Sin el texto: el contenido clinico ya vive en la fila y en la traza de
    // la sugerencia; aqui interesa QUIEN lo regenero y CUANDO, que es lo que responde "por que este
    // resumen no es el que yo lei".
    await recordAudit(tx, {
      event: "diagnosis.ai_summary.generated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "diagnosis",
      entityId: input.diagnosisId,
      payload: { caracteres: input.text.length },
      ip: input.ip,
    });
  });
}
