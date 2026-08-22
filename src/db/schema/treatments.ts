import { sql } from "drizzle-orm";
import { date, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { diagnoses } from "./diagnoses";
import { treatmentStatus } from "./enums";
import { nutraceuticals } from "./nutraceuticals";
import { profiles } from "./organizations";

// Grupo 9: tratamiento.

export const treatments = pgTable("treatments", {
  id: pk(),
  diagnosisId: uuid("diagnosis_id")
    .notNull()
    .references(() => diagnoses.id, { onDelete: "restrict" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id),
  // Objetivos del protocolo. En A2 pasan a ser los valores EFECTIVOS que escribe el service
  // (ajuste ?? sugerido); la UI no los edita directo. proteina_g = round(gkg_efectivo x
  // peso_efectivo). kcal_objetivo y proteina_g los sigue leyendo generate-menu.ts sin
  // tocarse. restricciones es el text[] del PROFESIONAL (distinto de las del modelo, que
  // viven en protocol_suggested). Nullable: el tratamiento puede existir antes de fijarlos.
  kcalObjetivo: integer("kcal_objetivo"),
  proteinaGramos: integer("proteina_g"),
  restricciones: text("restricciones")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  // --- T2 A2: protocolo por especialidad (tabla de Wang, Nivel IV apartados A/B/D) ---
  // Set SUGERIDO por el motor, sellado al crear el protocolo (inmutable, regla 7). Aloja
  // estrategia, protMin/protMax (rango g/kg, valor NO numerico), pesoCalculo, formula, los
  // derivados de D con los inputs sugeridos, los inputs de badges de Niveles II/III (sector,
  // AF, MCA_dif, hidSG, hidSG_ref, ECM_BCM) y las restricciones del MODELO ({nombre,valor,
  // ref}). Lo puebla el pipeline en A3. Constelacion (regla 7): el jsonb sella
  // protocol_engine_version (la version del modelo calorico, que ningun registro upstream
  // tiene y que Q14 hace critica); engine_version/model_version_id/rules_version se HEREDAN
  // del diagnostico via diagnosis_id (diagnoses los sella); survey_version_id vive upstream
  // en la respuesta de encuesta y no alimenta la cadena calorica.
  // DEFAULTS QUE PROPAGAN (ajuste T2): se sella al DIAGNOSTICAR, sin profesional, asi que PAL=1.375
  // y grasa=30% entran por DEFAULT (calorico.defaults=["pal","fatPct"]). PAL esta aguas arriba de
  // GET->kcalObj->proteina/grasa/CHO, de modo que TODA la cadena calorica del set sugerido es
  // PROVISIONAL, no solo esas dos claves: los valores efectivos los fija el profesional al aprobar
  // (protocol_approved). No leer get/kcalObj de aqui como firmes.
  protocolSuggested: jsonb("protocol_suggested"),
  // Set EFECTIVO tal como se PRESCRIBIO, sellado en la transicion draft -> approved
  // (inmutable, regla 7). Segundo sello, segundo momento clinico: campo aparte, no una clave
  // dentro de protocol_suggested, para no mutar un campo ya inmutable. Aloja los inputs
  // efectivos, los derivados de D con el peso efectivo, y las restricciones/micronutrientes
  // como se prescribieron, con su propia constelacion (protocol_engine_version al aprobar).
  // En borrador es NULL (el efectivo se recomputa en display); al aprobar lo escribe el
  // service y el trigger lo congela junto con protocol_suggested y approved_*. Un protocolo
  // aprobado NO se re-aprueba: para cambiarlo se crea un tratamiento nuevo (bloque de
  // correccion, sin construir). Por eso protocol_engine_version puede diferir ENTRE
  // tratamientos distintos, no entre aprobaciones del mismo.
  protocolApproved: jsonb("protocol_approved"),
  // Ajustes del profesional sobre el sugerido (apartados B/D + peso meta de Nivel V),
  // editables en borrador. Efectivo = ajuste ?? sugerido (lo resuelve el service).
  // peso_efectivo = adj_peso_meta ?? protocol_suggested.pesoCalculo, y entra a TODA la cadena
  // donde el HTML usa pesoN (Mifflin y protG), no solo a la proteina. numeric sin precision
  // por consistencia con el schema.
  adjGeb: integer("adj_geb"),
  adjPal: numeric("adj_pal"),
  adjKcalObj: integer("adj_kcal_obj"),
  adjProtGkg: numeric("adj_prot_gkg"),
  adjFatPct: integer("adj_fat_pct"),
  adjPesoMeta: numeric("adj_peso_meta"),
  // Estado de aprobacion. default 'draft' es una decision SEMANTICA deliberada: los
  // tratamientos previos (B13/demo) nunca pasaron por una aprobacion formal porque el
  // concepto no existia, asi que draft es correcto; no es un default por conveniencia.
  status: treatmentStatus("status").notNull().default("draft"),
  // approved_by = quien PRESCRIBIO (convierte la sugerencia del modelo en prescripcion). NO
  // forzosamente created_by: por regla 14, un profesional reasignado al paciente puede
  // aprobar un borrador que no creo; la autoridad la gobierna una policy + RLS (regla 3).
  // RESTRICT explicito (regla 14, escrito, no por defecto).
  approvedBy: uuid("approved_by").references(() => profiles.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  // Reconocimiento del profesional de las restricciones del MODELO antes de generar el menu
  // (gate del generador, Opcion B). El "que se reconocio" no se duplica: son las
  // restricciones de protocol_suggested (inmutable), asi que basta at + by. RESTRICT (regla 14).
  restrictionsAckAt: timestamp("restrictions_ack_at", { withTimezone: true }),
  restrictionsAckBy: uuid("restrictions_ack_by").references(() => profiles.id, {
    onDelete: "restrict",
  }),
  // Nivel III: requerimientos especificos de micronutrientes, texto libre del profesional.
  micronutrientesTexto: text("micronutrientes_texto"),
  // "Objetivo del tratamiento nutricional" (pieza 1, checkpoint 2.4): el objetivo/tipo de dieta que ESCRIBE
  // el profesional (distinto de las guias, que son una lista). Texto libre acotado. Es contenido del PLAN
  // (patient-facing via el futuro envio del plan, no el reporte del diagnostico). CORRECCION 2026-08-22: el
  // comentario anterior decia "inmutable al aprobar (trigger)"; era FALSO, el trigger treatments_immutability
  // (0026) NO lista objetivo_texto (ni restricciones, que es editable a proposito). El plan es EDITABLE tras
  // aprobar; solo la prescripcion (cadena calorica) se congela. Ver BACKLOG (hallazgos de CP1.2).
  objetivoTexto: text("objetivo_texto"),
  // Lista de intercambio (CP1.2): porciones por grupo que el profesional ajusta, con el objetivo con el que se
  // calcularon (objetivoBase) para avisar de desfase sin recalcular (opcion 3, DIV-11). jsonb:
  // { objetivoBase: number, grupos: { G1: {porciones,sub}, ... } }. null = nunca guardada (el panel usa los
  // defaults frescos de computeIntercambio). Contenido del PLAN, EDITABLE tras aprobar (el trigger de
  // inmutabilidad NO lo congela, igual que objetivo_texto/restricciones/menu: la prescripcion -cadena calorica-
  // se congela, el plan que se arma alrededor se sigue refinando). Si algun dia el plan debe congelarse al
  // aprobar, se agrega esta columna al trigger treatments_immutability (0026) de forma explicita.
  intercambioPorciones: jsonb("intercambio_porciones"),
  // Nivel V: proxima cita. CAMPO BOBO: dato clinico, NO sistema de agendamiento (sin
  // notificaciones, recordatorios, calendario ni logica). Una sola fecha; la profesion ya
  // esta implicita en created_by. Si algun dia hay agenda, se migra.
  proximaCita: date("proxima_cita"),
  createdAt: createdAt(),
});

// NATURALEZA SEGUN EL ESTADO (no asumir que siempre es lo mismo): en borrador (status='draft') estas
// filas SON la prescripcion autoritativa; al aprobar, lo autoritativo pasa a ser el jsonb sellado
// treatments.protocol_approved (inmutable, trigger 0026) y estas quedan como copia de trabajo (editable
// por diseno para el generador de menu). Detalle y el candado de escritura: data/treatment-writer.ts.
export const treatmentNutraceuticals = pgTable("treatment_nutraceuticals", {
  id: pk(),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "cascade" }),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id),
  dosage: text("dosage"),
  durationDays: integer("duration_days"),
});

export const treatmentDietGuidelines = pgTable("treatment_diet_guidelines", {
  id: pk(),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "cascade" }),
  guidelineText: text("guideline_text").notNull(),
});

export const treatmentNotes = pgTable("treatment_notes", {
  id: pk(),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: createdAt(),
});
