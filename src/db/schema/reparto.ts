import { boolean, date, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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

// ═══ UBICACIONES Y LOTES (migracion 0120/0121) ═══
//
// El saldo dejo de llevarse por (profesional, producto) y pasa a (UBICACION, producto, LOTE). La ubicacion
// es la respuesta a "¿donde esta?" y la central no tiene dueño, que es lo que permite registrar las
// unidades de CNV. El lote es el principio 8: sin el no hay trazabilidad hasta el paciente.

export const suppliers = pgTable("suppliers", {
  id: pk(),
  name: text("name").notNull(),
  taxIdType: text("tax_id_type"),
  taxIdNumber: text("tax_id_number"),
  taxIdDv: text("tax_id_dv"),
  taxIsVatResponsible: boolean("tax_is_vat_responsible"),
  taxIsWithholdingAgent: boolean("tax_is_withholding_agent"),
  alegraContactId: text("alegra_contact_id"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const inventoryLocations = pgTable("inventory_locations", {
  id: pk(),
  name: text("name").notNull(),
  /** 'central' | 'integrante'. La central es la unica sin dueño (restriccion en la migracion). */
  kind: text("kind").notNull(),
  professionalId: uuid("professional_id").references(() => professionalProfiles.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const lots = pgTable("lots", {
  id: pk(),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id),
  code: text("code").notNull(),
  expiresOn: date("expires_on").notNull(),
  receivedOn: date("received_on"),
  notes: text("notes"),
  createdAt: createdAt(),
});

// ═══ ALERGENOS (0123, replanteado el 2026-09-11) ═══
//
// ESTE BLOQUE DECIA LO CONTRARIO Y SE CONSERVA CORREGIDO, porque el error explica la forma actual.
// Decia: "por que una tabla y no un cotejo de cadenas... comparar textos deja pasar a un celiaco", y
// "se construye y no se enciende: el bloqueo solo considera relaciones FIRMADAS".
//
// NO HAY BLOQUEO NI HABRA, y la tabla de equivalencias (`allergen_relations`) SE RETIRO en la 0127. Dos
// instrucciones independientes lo prohiben:
//
//   · DIRECCION CIENTIFICA (27-ago, 11-sep): traducir un ingrediente a una alergia es contenido clinico
//     que el modelo ANI-BIS-E no tiene.
//   · ASESOR LEGAL (11-sep): bloquear obliga a Atlas a afirmar que la alergia y el alergeno son
//     incompatibles, o sea a INFERIR CLINICAMENTE, y eso contradice el Anexo 3 y el consentimiento que
//     los pacientes ya firmaron, donde dice que Atlas no diagnostica y el profesional interpreta.
//
// LO QUE SE HACE EN SU LUGAR: yuxtaponer. Las dos declaraciones textuales, una al lado de la otra, sin
// compararlas. Ver `modules/nutraceuticals/yuxtaposicion-alergenos`.
//
// Y LA PREOCUPACION ORIGINAL SIGUE SIENDO CIERTA (ninguna cadena contiene a la otra), solo que ya no es
// nuestro problema que resolver: la valoracion de compatibilidad es del profesional tratante.

export const allergens = pgTable("allergens", {
  id: pk(),
  /** Clave canonica en minusculas y sin tildes: 'gluten', 'lactosa', 'mani'. */
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
});

// `allergenRelations` VIVIA AQUI y se retiro con su tabla en la 0127. No se deja vacia a proposito:
// una tabla con un enum de tipos de equivalencia (`directa`, `por_contaminacion_cruzada`) no es neutral,
// es un formulario, y el dia que alguien quiera "solo dejar anotado" que la avena arrastra gluten, la
// estructura le dice como. Una ausencia se sostiene mejor con un documento que con un hueco que invita.

export const nutraceuticalAllergens = pgTable("nutraceutical_allergens", {
  id: pk(),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id, { onDelete: "cascade" }),
  allergenId: uuid("allergen_id").notNull().references(() => allergens.id),
  /** VERBATIM de la ficha del fabricante. Lo que el producto DICE, no lo que implica. */
  declaredAs: text("declared_as").notNull(),
  /** Certificacion de ausencia del alergeno destino. Nulo = no certificado. */
  absenceCertifiedFor: uuid("absence_certified_for").references(() => allergens.id),
  notes: text("notes"),
  createdAt: createdAt(),
});

/**
 * EL PUENTE CON LA ENCUESTA, anclado al ID DE LA OPCION y no a su etiqueta.
 *
 * Si Direccion Cientifica reescribe "Gluten (trigo, pan, pasta)", un cotejo por texto se apagaria en
 * silencio. El id no cambia por una reescritura, y ya lleva su version de encuesta dentro (la opcion
 * cuelga de la pregunta y la pregunta de la version).
 */
// IDENTIDAD, no equivalencia: la opcion "Gluten (trigo, pan, pasta)" ES el alergeno gluten, la misma
// cosa nombrada dos veces. Por eso sobrevive al retiro de `allergenRelations`, que relacionaba alergenos
// DISTINTOS entre si.
//
// HOY NO TIENE LECTOR, y queda anotado como decision y no como olvido: la yuxtaposicion muestra la
// respuesta CRUDA del paciente, tal como la escribio, no su normalizacion. Se conserva porque mapear la
// opcion a su alergeno costo un defecto real de encontrar (las versiones viejas de la encuesta quedaron
// sin mapear por buscar por texto) y rehacerlo seria repetir ese trabajo.
export const surveyOptionAllergens = pgTable("survey_option_allergens", {
  id: pk(),
  surveyOptionId: uuid("survey_option_id").notNull(),
  allergenId: uuid("allergen_id").notNull().references(() => allergens.id),
  createdAt: createdAt(),
});
