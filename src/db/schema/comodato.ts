import { date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { assignmentStatus } from "./enums";
import { devices } from "./bis";
import { professionalProfiles } from "./organizations";

// Grupo 12: comodato (asignacion de equipos BIS a profesionales).

export const deviceAssignments = pgTable(
  "device_assignments",
  {
    id: pk(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "restrict" }),
    startDate: date("start_date").notNull(),
    expectedEndDate: date("expected_end_date").notNull(),
    actualReturnDate: date("actual_return_date"), // nulo hasta devolucion
    status: assignmentStatus("status").notNull().default("active"),
    legalDocumentUrl: text("legal_document_url"), // PDF del comodato firmado
    createdAt: createdAt(),
  },
  (t) => [
    index("device_assignments_device_idx").on(t.deviceId),
    index("device_assignments_professional_idx").on(t.professionalId),
  ],
);
