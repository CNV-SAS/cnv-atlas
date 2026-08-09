import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import {
  nutraceuticalAvailability,
  nutraceuticalFaltanteCharge,
  nutraceuticalFaltanteJustification,
  nutraceuticalFaltanteStatus,
  nutraceuticalMovementType,
} from "./enums";
import { organizations, professionalProfiles, profiles } from "./organizations";
import { treatments } from "./treatments";

// Grupo 13: nutraceuticos. Catalogo VITACELLEBIS. Fuente de la GRAFIA del nombre: el registro
// sanitario (INVIMA), no la tienda; cuando difieran, manda el registro (ver DATA_GOVERNANCE).
// El precio se SELLA en transaction_items.unit_price al crear el checkout: cambiarlo aqui afecta
// solo checkouts futuros, no transacciones pasadas.

export const nutraceuticals = pgTable("nutraceuticals", {
  id: pk(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit"),
  unitPrice: numeric("unit_price"),
  // Datos del catalogo VITACELLEBIS (tienda + registro sanitario).
  indication: text("indication"), // para que sirve
  composition: text("composition"), // ingredientes
  presentation: text("presentation"), // linea: liquida | polvo
  servingSize: text("serving_size"), // porcion: "30 mL", "25 g"...
  sanitaryRegistration: text("sanitary_registration"), // RSA-.../NSA-...
  commercialAvailability: nutraceuticalAvailability("commercial_availability")
    .notNull()
    .default("no_disponible"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Saldo de custodia POR PROFESIONAL (consignacion): el producto es de CNV, ubicado en la vitrina del
// integrante. stock_quantity es un CACHE del saldo (suma de los movimientos); lo mueve SOLO el trigger
// del movimiento, nunca escritura directa (coherencia por trigger, migracion 0040). Una fila por
// (profesional, producto).
export const nutraceuticalInventory = pgTable(
  "nutraceutical_inventory",
  {
    id: pk(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id),
    nutraceuticalId: uuid("nutraceutical_id")
      .notNull()
      .references(() => nutraceuticals.id, { onDelete: "cascade" }),
    stockQuantity: integer("stock_quantity").notNull().default(0), // saldo cacheado = suma de movimientos
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("nutra_inventory_prof_nutra_unique").on(t.professionalId, t.nutraceuticalId)],
);

// Movimientos de inventario en consignacion: la FUENTE DE VERDAD auditable del saldo. Cada uno es
// INMUTABLE (trigger append-only, migracion 0040): un movimiento mal registrado NO se edita ni se borra,
// se corrige con otro en sentido contrario. El saldo (nutraceutical_inventory) es una proyeccion que
// SOLO mueve el trigger de este insert. delta con signo (+recepcion, -despacho, +/-conciliacion).
export const nutraceuticalStockMovements = pgTable(
  "nutraceutical_stock_movements",
  {
    id: pk(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id),
    nutraceuticalId: uuid("nutraceutical_id")
      .notNull()
      .references(() => nutraceuticals.id),
    delta: integer("delta").notNull(), // con signo
    type: nutraceuticalMovementType("type").notNull(),
    reason: text("reason"),
    // Lote del producto (opcional). Lo pide el reporte de faltante ("referencia, lote y cantidad") y lo
    // captura la recepcion. NO cambia el saldo (sigue por producto): el inventario POR LOTE completo
    // (saldo/vencimiento por lote) es un modelo mayor, diferido (ver BACKLOG T3b-3).
    lote: text("lote"),
    // Despacho (T3b-2): liga la entrega al tratamiento (y por el, al paciente). Nullable: los demas
    // tipos (recepcion, conciliacion, devolucion) son comerciales, sin paciente.
    treatmentId: uuid("treatment_id").references(() => treatments.id, { onDelete: "set null" }),
    // Conciliacion de SOBRANTE (T3b-3 ST5): liga el ajuste +N a la linea de conteo que lo origino. Asi se
    // sabe que sobrantes ya se resolvieron (una linea con sobrante SIN movimiento que la referencie sigue
    // pendiente). Nullable: los demas movimientos no salen de un conteo.
    countLineId: uuid("count_line_id").references(() => nutraceuticalCountLines.id),
    // Remesa (E2): vincula una RECEPCION a la REMESA de CNV que la respalda (auto-FK a la fila type=remesa).
    // NULL en una recepcion = NO respaldada = discrepancia visible (mismo patron que superseded_at sin su
    // fila de correccion). Solo aplica a type=recepcion (CHECK en la migracion). La remesa misma NO mueve
    // el saldo del integrante (el trigger del saldo excluye type=remesa; el saldo sube al recibir).
    remesaId: uuid("remesa_id").references((): AnyPgColumn => nutraceuticalStockMovements.id),
    // Cantidad REPORTADA por el integrante al confirmar una remesa (lo que dice que llego), que puede diferir
    // de `delta` (el efecto en el saldo). Asimetria deliberada: recibir de MENOS mueve el saldo por lo
    // confirmado (delta=reportada); recibir de MAS lo mueve solo por lo DECLARADO (delta=declarada, capado),
    // y el excedente NO infla el saldo sin que CNV lo reconozca (lo reconcilia el conteo/sobrante). Se guarda
    // lo reportado para que CNV vea la DIRECCION (falto/sobro). null en movimientos que no confirman remesa.
    reportedQuantity: integer("reported_quantity"),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [index("nutra_movements_prof_nutra_idx").on(t.professionalId, t.nutraceuticalId)],
);

export const nutraceuticalUsage = pgTable("nutraceutical_usage", {
  id: pk(),
  treatmentId: uuid("treatment_id")
    .notNull()
    .references(() => treatments.id, { onDelete: "cascade" }),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id),
  quantity: integer("quantity").notNull(),
});

// CASO de faltante (T3b-3): el conteo fisico detecta que falta producto de CNV en la custodia del
// integrante. NO es un ajuste de inventario: es un registro con CONSECUENCIA ECONOMICA, asi que se trata
// como los movimientos: la FUENTE DE VERDAD son las transiciones (append-only, abajo) y aqui viven los
// HECHOS SELLADOS (producto, cantidad, precio al momento del faltante) mas un CACHE del estado y del cargo,
// proyectado por trigger desde la ultima transicion. Un caso que se reclasifica NO se edita: se registra
// otra transicion. El cargo se materializa (charge_status) SOLO al confirmar injustificado (dos personas).
export const nutraceuticalFaltanteCases = pgTable(
  "nutraceutical_faltante_cases",
  {
    id: pk(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id),
    nutraceuticalId: uuid("nutraceutical_id")
      .notNull()
      .references(() => nutraceuticals.id),
    lote: text("lote"), // opcional (el reporte de faltante lo pide cuando aplica)
    quantity: integer("quantity").notNull(), // unidades faltantes, sellado a la deteccion
    // Precio de venta SELLADO al momento del faltante (deteccion), NO se re-lee despues (Clausula 5.4 del
    // Anexo 2). Misma disciplina que transaction_items.unit_price en el checkout.
    sealedUnitPrice: numeric("sealed_unit_price").notNull(),
    sealedTotal: numeric("sealed_total").notNull(), // quantity * sealed_unit_price
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(), // reported_at + 5 dias habiles
    // Justificacion enviada por el integrante: categoria + referencia OBLIGATORIA (numero de denuncia,
    // guia, o id del movimiento de correccion). Write-once (trigger).
    justificationCategory: nutraceuticalFaltanteJustification("justification_category"),
    justificationReference: text("justification_reference"),
    // CACHE proyectado desde la ultima transicion (trigger 0042). NO se escribe directo (coherencia).
    status: nutraceuticalFaltanteStatus("status").notNull().default("reportado"),
    chargeStatus: nutraceuticalFaltanteCharge("charge_status").notNull().default("sin_cargo"),
    // Conteo del que salio el caso (T3b-3 ST2): reconstruye de donde vino cada faltante. Un mismo conteo
    // puede abrir VARIOS casos (uno por producto), independientes (cada uno con su plazo y clasificacion).
    countSessionId: uuid("count_session_id").references(() => nutraceuticalCountSessions.id),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("nutra_faltante_prof_idx").on(t.professionalId),
    index("nutra_faltante_status_idx").on(t.status),
  ],
);

// Transiciones del caso de faltante: la FUENTE DE VERDAD (append-only, inmutable por trigger, como los
// movimientos de inventario). Cada cambio de estado es una fila con su actor, motivo y (en la transicion
// de justificacion) categoria + referencia. El estado del caso es el to_status de la ultima. Una
// reclasificacion es una transicion nueva, no una edicion; asi queda el rastro de quien decidio que.
export const nutraceuticalFaltanteTransitions = pgTable(
  "nutraceutical_faltante_transitions",
  {
    id: pk(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => nutraceuticalFaltanteCases.id),
    fromStatus: nutraceuticalFaltanteStatus("from_status"), // null en la apertura del caso
    toStatus: nutraceuticalFaltanteStatus("to_status").notNull(),
    justificationCategory: nutraceuticalFaltanteJustification("justification_category"),
    justificationReference: text("justification_reference"),
    reason: text("reason"), // motivo del admin/direccion en la clasificacion
    actorId: uuid("actor_id").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [index("nutra_faltante_trans_case_idx").on(t.caseId)],
);

// SESION DE CONTEO fisico (T3b-3 ST2): el conteo SEMANAL de la consignacion. Se registra SIEMPRE, cuadre o
// no: es la evidencia de que el integrante cumplio su obligacion (su ausencia tambien dice algo; sin esto no
// se sabe quien cuenta y quien no). Puede ser PARCIAL: las lineas registran QUE se conto, asi un conteo de
// pocos productos no se lee como completo. Inmutable (append-only): un reconteo es una sesion nueva.
export const nutraceuticalCountSessions = pgTable(
  "nutraceutical_count_sessions",
  {
    id: pk(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id),
    note: text("note"),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [index("nutra_count_prof_idx").on(t.professionalId)],
);

// Linea del conteo: lo contado por producto. Guarda el fisico y el SALDO DEL SISTEMA en ese momento
// (snapshot), para que el diff quede anclado a lo que el sistema decia al contar. diff = physical - system:
// negativo = faltante (abre caso), positivo = sobrante (se registra, no ajusta en silencio), cero = cuadra.
export const nutraceuticalCountLines = pgTable(
  "nutraceutical_count_lines",
  {
    id: pk(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => nutraceuticalCountSessions.id),
    nutraceuticalId: uuid("nutraceutical_id")
      .notNull()
      .references(() => nutraceuticals.id),
    lote: text("lote"),
    physicalQty: integer("physical_qty").notNull(), // lo contado
    systemQty: integer("system_qty").notNull(), // saldo del sistema al momento del conteo (snapshot)
    createdAt: createdAt(),
  },
  (t) => [index("nutra_count_lines_session_idx").on(t.sessionId)],
);
