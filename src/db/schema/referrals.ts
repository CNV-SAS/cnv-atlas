import { date, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { referralTarget } from "./enums";
import { organizations, profiles } from "./organizations";
import { patients } from "./patients";
import { treatments } from "./treatments";

// Grupo 9bis: remisiones (D-009). Remitir es una ACCION registrable: a quien, por que, cuando, y si el
// paciente volvio. Ancla en `treatment_id` (la remision sale de una ruta de atencion, que vive en el
// tratamiento) con ON DELETE RESTRICT: una correccion supersede evaluacion/diagnostico/treatment pero NO
// los borra, asi que la remision SOBREVIVE (el acto ocurrio). Lleva ademas `patient_id` para poder
// listarla por paciente a traves de correcciones (el treatment vigente cambia; el acto queda).
//
// INMUTABLE (trigger 00xx): los campos nucleo no se editan y no se borra. El UNICO cambio permitido es
// setear `returned_at`/`return_notes` UNA vez (null -> valor): "el paciente volvio" es un SEGUNDO acto,
// no una edicion del primero. Corregir una remision mal puesta seria otra transicion (post-MVP), no un UPDATE.
export const referrals = pgTable("referrals", {
  id: pk(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "restrict" }),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "restrict" }),
  // Destinatario estructurado (enum) + texto libre solo cuando es "otro" (la app/CHECK lo exige).
  referredTo: referralTarget("referred_to").notNull(),
  referredToOther: text("referred_to_other"),
  reason: text("reason").notNull(),
  referredAt: date("referred_at").notNull(),
  // "El paciente volvio": segundo acto, write-once (null -> valor), gobernado por el trigger de inmutabilidad.
  returnedAt: date("returned_at"),
  returnNotes: text("return_notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id),
  createdAt: createdAt(),
});
