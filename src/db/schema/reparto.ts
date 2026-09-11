import { date, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { createdAt, pk } from "./_columns";
import { nutraceuticals } from "./nutraceuticals";
import { professionalProfiles, profiles } from "./organizations";


// ═══ EL REPARTO DEL PRECIO (migracion 0119) ═══
//
// EL CRITERIO (Santiago, 2026-09-11): la comision del Integrante es SUYA y aplica a todos los productos
// por igual. Asi que el reparto NO es una cifra por producto:
//
//   · la participacion del INTEGRANTE sale de su tasa (tabla de abajo, con vigencia),
//   · la del PROVEEDOR sale del producto (`revenue_splits`, solo en producto de tercero),
//   · y la de CNV es EL RESIDUO.
//
// El modelo comercial no solo lo admite, lo AFIRMA (§7.2): "El Integrante recibe la misma participacion
// que en los productos propios... La diferencia la absorbe CNV, que pasa de su margen habitual a un 10%".
//
// LA CONSECUENCIA: si el Integrante sube al 30%, CNV baja al 0% en LUVIA. Por encima, CNV PAGA por
// vender. Lo impide un trigger, no una validacion de aplicacion: ver la migracion.

/**
 * CONFIGURACION COMERCIAL. Fila unica, como `ai_config`.
 *
 * Existe para que el umbral de aviso por defecto no viva en el codigo (principio 2 del modelo comercial:
 * nada de valores fijos). El BLOQUEO del negativo NO esta aqui: ese es invariante del sistema y vive en
 * el trigger, porque CNV pagando por vender no es una politica que se pueda relajar.
 */
export const commercialConfig = pgTable("commercial_config", {
  id: pk(),
  /** Umbral de aviso por defecto sobre el RESIDUO de CNV, en fraccion (0,10 = 10%). */
  margenAvisoDefault: numeric("margen_aviso_default").notNull().default("0"),
  updatedBy: uuid("updated_by").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * LA TASA DEL INTEGRANTE, CON VIGENCIA.
 *
 * POR QUE CON VIGENCIA Y NO UNA COLUMNA: la tasa dejo de ser un valor por defecto cosmetico y paso a ser
 * el TERMINO DEL CONTRATO que gobierna el dinero. Cada venta sella la suya, asi que el pasado ya estaba a
 * salvo; lo que faltaba era poder RESPONDER por el. Una liquidacion tiene que poder explicarse, y "¿por
 * que se liquido al 20%?" necesita una respuesta CON FECHA.
 *
 * `professional_profiles.commission_rate` se conserva como la tasa de HOY (es lo que lee el sellado de
 * cada venta, y para una venta nueva la vigente es la de hoy). Esta tabla es la que explica el historial.
 */
export const professionalCommissionRates = pgTable(
  "professional_commission_rates",
  {
    id: pk(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    /** Fraccion sobre la BASE SIN IVA (principio 1 del modelo). 0,20 = 20%. */
    rate: numeric("rate").notNull(),
    validFrom: date("valid_from").notNull(),
    /** null = vigente. Cerrar una vigencia es poner fecha aqui e insertar la nueva. */
    validTo: date("valid_to"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  // UNA SOLA VIGENTE POR PROFESIONAL, garantizada por la base y no por la aplicacion. Mismo mecanismo
  // que `model_versions_one_active_idx`.
  (t) => [
    uniqueIndex("pcr_una_vigente_por_profesional")
      .on(t.professionalId)
      .where(sql`valid_to IS NULL`),
  ],
);

/**
 * LA PARTICIPACION DEL PROVEEDOR EXTERNO, POR PRODUCTO Y CON VIGENCIA.
 *
 * SOLO LLEVA LA DEL PROVEEDOR. La del Integrante no va aqui (es suya y vale para todos los productos) y
 * la de CNV tampoco (es el residuo, y guardarla seria una tercera cifra capaz de contradecir a las otras
 * dos). Un producto propio no tiene fila, o la tiene en 0.
 *
 * POR QUE CON VIGENCIA: contabilidad acepto el 10% de CNV en LUVIA SOLO para el piloto, y se renegocia
 * antes de un segundo lote. Sabemos de antemano que se va a mover, asi que el modelo tiene que
 * EXPRESARLO: sin vigencia habria que editar la fila, y editarla reescribiria lo ya liquidado.
 */
export const revenueSplits = pgTable(
  "revenue_splits",
  {
    id: pk(),
    nutraceuticalId: uuid("nutraceutical_id")
      .notNull()
      .references(() => nutraceuticals.id, { onDelete: "cascade" }),
    /** Fraccion sobre la BASE SIN IVA que se lleva el proveedor externo. LUVIA: 0,70. */
    supplierShare: numeric("supplier_share").notNull(),
    /**
     * UMBRAL DE AVISO DE ESTE PRODUCTO, sobre el residuo de CNV. null = usa el global.
     *
     * ES POR PRODUCTO Y NO GLOBAL porque un producto propio deja a CNV el 80% y uno de tercero el 10%:
     * con un umbral unico del 10%, todo producto propio pasaria siempre y LUVIA avisaria desde el primer
     * dia. El umbral es politica comercial; el bloqueo del negativo es invariante y vive en el trigger.
     */
    margenAviso: numeric("margen_aviso"),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("rs_una_vigente_por_producto")
      .on(t.nutraceuticalId)
      .where(sql`valid_to IS NULL`),
  ],
);
