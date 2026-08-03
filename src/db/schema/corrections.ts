import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { correctionTriggerType } from "./enums";
import { evaluations } from "./evaluations";
import { profiles } from "./organizations";

// Flujo de correccion post-diagnostico (gate del Hito 1, ver docs/PLAN_FLUJO_CORRECCION.md).
// La UNICA fuente de la relacion de sucesion: quien reemplazo a que, por que, y disparada por que.
// Lista enlazada (v1 -> v2 -> v3): cada fila apunta old_evaluation_id -> new_evaluation_id. La
// vigencia se DERIVA de aqui (una evaluacion esta reemplazada sii aparece como old_evaluation_id);
// evaluations.superseded_at es solo una proyeccion barata que ESTE insert mantiene por trigger.
//
// Append-only: es parte del registro clinico. No se actualiza ni se borra (trigger de inmutabilidad
// en 0030, ademas de que RLS no da UPDATE/DELETE). Borrar una correccion dejaria superseded_at
// colgando y "des-reemplazaria" una evaluacion: prohibido.
export const clinicalCorrections = pgTable(
  "clinical_corrections",
  {
    id: pk(),
    // La evaluacion vigente que se corrige (pasa a reemplazada). RESTRICT: no se borra lo que
    // participo en una correccion.
    oldEvaluationId: uuid("old_evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "restrict" }),
    // La version nueva que la reemplaza (la cadena re-emitida cuelga de esta).
    newEvaluationId: uuid("new_evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "restrict" }),
    // Quien corrige. Acto clinico: el profesional asignado (la policy lo verifica, regla 3).
    correctedBy: uuid("corrected_by")
      .notNull()
      .references(() => profiles.id),
    // Motivo obligatorio (PLAN (d)): una correccion sin motivo es indistinguible de un error.
    reason: text("reason").notNull(),
    // Disparador (PLAN (g)): correccion del profesional vs recalibracion de ciencia. Misma maquinaria.
    triggerType: correctionTriggerType("trigger_type").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("clinical_corrections_old_idx").on(t.oldEvaluationId),
    index("clinical_corrections_new_idx").on(t.newEvaluationId),
  ],
);
