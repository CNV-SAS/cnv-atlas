import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { contraindicationSource } from "./enums";
import { nutraceuticals } from "./nutraceuticals";
import { profiles } from "./organizations";
import { patients } from "./patients";

// CONTRAINDICACIONES DEL PACIENTE (2026-08-24). Cuelgan del PACIENTE, no de la evaluacion, y esa es toda
// la decision: una contraindicacion es de la PERSONA, no de esa consulta. Una alergia al calostro vale con
// cualquier profesional y en cualquier evaluacion futura.
//
// POR QUE NO CABE EN LO QUE YA EXISTE (verificado antes de crear la tabla):
//  - `bis_conditions`: son de ESA medicion (ayuno, hidratacion), no persisten.
//  - antecedentes de la encuesta (d5_39, d6_43...): los declara el PACIENTE y se rehacen cada evaluacion;
//    esto lo registra el PROFESIONAL.
//  - `treatment_notes`: texto libre de esa consulta, no consultable ni mostrable junto a un producto.
//
// ES DATO CLINICO: hereda las reglas de acceso del paciente (RLS por la relacion paciente-profesional,
// igual que el resto de su historia). No es dato comercial y no se muestra en las metricas de venta; lo
// comercial es la RAZON de la decision, que vive en el tratamiento.
export const patientContraindications = pgTable(
  "patient_contraindications",
  {
    id: pk(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    // Producto concreto cuando lo hay. Nullable a proposito: una contraindicacion puede ser de un
    // COMPONENTE ("calostro") sin producto asociado, y el catalogo no modela componentes todavia (su
    // `composition` es texto libre). Cuando exista ese modelo, esta columna convive con el.
    nutraceuticalId: uuid("nutraceutical_id").references(() => nutraceuticals.id, {
      onDelete: "restrict",
    }),
    source: contraindicationSource("source").notNull(),
    // El motivo, tal como lo escribio el profesional. Es lo que leera el siguiente que atienda al paciente.
    reason: text("reason").notNull(),
    // Quien la registro. RESTRICT (regla 14): una cuenta clinica no se recicla ni se borra.
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [index("patient_contraindications_patient_idx").on(t.patientId)],
);
