"use server";

import { revalidatePath } from "next/cache";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { reportServerError } from "@/lib/observability/report-error";
import { getCurrentUser } from "@/modules/auth/session";

import { canLoadOwnStock } from "./policies/can-load-own-stock";
import { canManageCatalog } from "./policies/can-manage-catalog";
import { canRegisterUsage } from "./policies/can-register-usage";
import { canCerrarDevolucion } from "./policies/can-cerrar-devolucion";
import { canDeclararRemesa } from "./policies/can-declarar-remesa";
import {
  canClassifyFaltante,
  canConfirmFaltante,
  canResolveSobrante,
  canSeeFaltanteQueue,
} from "./policies/can-review-faltante";
import * as faltanteService from "./services/faltante-service";
import * as inventoryService from "./services/inventory-service";
import * as service from "./services/nutraceuticals-service";
import * as devolucionService from "./services/devolucion-a-cnv-service";
import * as remesaService from "./services/remesa-service";
import * as vencimientosLectura from "./services/vencimientos-lectura";
import {
  classifyFaltanteSchema,
  confirmFaltanteSchema,
  confirmRemesaSchema,
  declareRemesaSchema,
  resolveSobranteSchema,
  createNutraceuticalSchema,
  cerrarDevolucionSchema,
  completarVencimientoSchema,
  declararDevolucionSchema,
  marcarVencimientoVistoSchema,
  recordCountSchema,
  registerUsageSchema,
  submitJustificationSchema,
  updateNutraceuticalSchema,
  type CreateNutraceuticalInput,
  type NutraceuticalFormState,
  type RegisterUsageInput,
  type UpdateNutraceuticalInput,
} from "./validations";

// Autorizacion comun por capacidad (regla 3). Catalogo = admin; inventario =
// admin/soporte; uso = professional (la RLS acota al profesional del paciente).
async function requireCatalogManager() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesión.") };
  if (!canManageCatalog(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso sobre el catalogo.") };
  }
  return { user, error: null as null };
}

async function requireUsageRegistrar() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesión.") };
  if (!canRegisterUsage(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso para registrar uso.") };
  }
  return { user, error: null as null };
}

export async function createNutraceuticalAction(
  input: CreateNutraceuticalInput,
): Promise<Result<{ id: string }, AppError>> {
  const { user, error: authzError } = await requireCatalogManager();
  if (authzError) return err(authzError);

  const parsed = createNutraceuticalSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos del nutracéutico inválidos."));

  try {
    const created = await service.createNutraceutical(parsed.data, user.organizationId);
    revalidatePath("/nutraceuticos");
    return ok({ id: created.id });
  } catch (e) {
    reportServerError("nutraceuticals.createNutraceutical", e);
    return err(appError("internal", "No se pudo crear el nutracéutico."));
  }
}

export async function updateNutraceuticalAction(
  input: UpdateNutraceuticalInput,
): Promise<Result<null, AppError>> {
  const { error: authzError } = await requireCatalogManager();
  if (authzError) return err(authzError);

  const parsed = updateNutraceuticalSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos del nutracéutico inválidos."));

  try {
    await service.updateNutraceutical(parsed.data);
    revalidatePath("/nutraceuticos");
    return ok(null);
  } catch (e) {
    reportServerError("nutraceuticals.updateNutraceutical", e);
    return err(appError("internal", "No se pudo actualizar el nutracéutico."));
  }
}

// Registro de uso (sin UI en B5; lo consume el flujo de tratamiento en B12).
export async function registerUsageAction(
  input: RegisterUsageInput,
): Promise<Result<{ usageId: string }, AppError>> {
  const { error: authzError } = await requireUsageRegistrar();
  if (authzError) return err(authzError);

  const parsed = registerUsageSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos de uso inválidos."));

  try {
    const usage = await service.registerUsage(parsed.data);
    return ok({ usageId: usage.id });
  } catch (e) {
    // La RLS rechaza si el actor no es el profesional del paciente del tratamiento. Se reporta igual:
    // si el fallo NO es de RLS sino un error real, tiene que dejar rastro (el area lo hace filtrable).
    reportServerError("nutraceuticals.registerUsage", e);
    return err(appError("forbidden", "No se pudo registrar el uso para este tratamiento."));
  }
}

// ----- Adaptadores de formulario (useActionState) para la UI de B5.3 -----

// Helpers de FormData: string opcional (vacio -> undefined) y numero opcional.
function optStr(formData: FormData, k: string): string | undefined {
  const v = String(formData.get(k) ?? "").trim();
  return v === "" ? undefined : v;
}
function optNum(formData: FormData, k: string): number | undefined {
  const v = optStr(formData, k);
  return v === undefined ? undefined : Number(v);
}

export async function createNutraceuticalFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const result = await createNutraceuticalAction({
    name: optStr(formData, "name") ?? "",
    description: optStr(formData, "description"),
    unit: optStr(formData, "unit"),
    unitPrice: optNum(formData, "unitPrice"),
  });
  if (!result.ok) return { error: result.error.message, success: null, warning: null };
  return { error: null, success: "Nutracéutico creado.", warning: null };
}

export async function updateNutraceuticalFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const result = await updateNutraceuticalAction({
    id: String(formData.get("id") ?? ""),
    commercialAvailability: String(formData.get("commercialAvailability") ?? "no_disponible") as
      | "en_consultorio"
      | "solo_tienda"
      | "no_disponible",
    name: optStr(formData, "name") ?? "",
    description: optStr(formData, "description"),
    unit: optStr(formData, "unit"),
    unitPrice: optNum(formData, "unitPrice"),
  });
  if (!result.ok) return { error: result.error.message, success: null, warning: null };
  return { error: null, success: "Nutracéutico actualizado.", warning: null };
}

// LA RECEPCION QUE TECLEABA EL PROFESIONAL SE RETIRO (Santiago, 2026-09-25). Aqui vivia
// `recordReceptionFormAction`. El mecanismo bueno ya existia: CNV declara la remesa y el integrante la
// confirma, que ademas deja el rastro de quien mando que. Con las dos, podia entrar inventario que CNV nunca
// declaro, y eso hace que el saldo deje de ser cotejable contra lo enviado.

// Declarar una REMESA (E2): CNV declara un envío en consignación a un integrante. Solo admin/soporte
// (Operaciones); el integrante no declara. No mueve el saldo (eso pasa al confirmar la recepción).
export async function declareRemesaFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canDeclararRemesa(user)) {
    return { error: "Solo CNV (admin u operaciones) declara remesas.", success: null, warning: null };
  }
  const parsed = declareRemesaSchema.safeParse({
    professionalId: String(formData.get("professionalId") ?? ""),
    nutraceuticalId: String(formData.get("nutraceuticalId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    lote: optStr(formData, "lote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos de la remesa inválidos.", success: null, warning: null };
  }
  const res = await remesaService.declareRemesa({
    actorId: user.id,
    professionalId: parsed.data.professionalId,
    nutraceuticalId: parsed.data.nutraceuticalId,
    quantity: parsed.data.quantity,
    lote: parsed.data.lote ?? null,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo declarar la remesa.", success: null, warning: null };
  revalidatePath("/faltantes");
  return { error: null, success: "Remesa declarada. El integrante la verá en Mi inventario para confirmarla.", warning: null };
}

// Confirmar una REMESA (E2): el integrante reconoce cuánto llegó. Solo el profesional (canLoadOwnStock; la
// RLS y el service acotan a que la remesa sea suya). El aviso DICE qué pasó con las cantidades (requisito a/b
// del checkpoint 3): cuando difieren, el integrante tiene que entender por qué su saldo no coincide con lo que
// cuenta en la vitrina, y sin acusarlo de nada (aún no se sabe si fue transporte).
export async function confirmRemesaFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional confirma las remesas de su inventario.", success: null, warning: null };
  }
  const parsed = confirmRemesaSchema.safeParse({
    remesaId: String(formData.get("remesaId") ?? ""),
    actualQuantity: String(formData.get("actualQuantity") ?? ""),
    lote: optStr(formData, "lote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos de la confirmación inválidos.", success: null, warning: null };
  }

  const res = await remesaService.confirmRemesa({
    userId: user.id,
    remesaId: parsed.data.remesaId,
    actualQuantity: parsed.data.actualQuantity,
    lote: parsed.data.lote ?? null,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo confirmar la remesa.", success: null, warning: null };
  // NO se revalida aquí: el formulario de esta remesa desaparece de la lista de pendientes tras confirmar,
  // y un revalidate lo desmontaría antes de que se vea el aviso. El cliente (useFormToastAndRefresh) muestra
  // el aviso y LUEGO refresca. Aplica a los cuatro casos (igual/faltó/sobró/cero), incluido el de éxito exacto.

  const { declared = 0, reported = 0, balanceApplied = 0, difference = 0 } = res;
  if (difference === 0) {
    return { error: null, success: `Recepción confirmada: ${reported} unidades, como CNV declaró.`, warning: null };
  }
  if (difference > 0) {
    // Sobró: el saldo sube solo lo declarado; el excedente queda para CNV (no se infla el inventario). El
    // aviso dice el POR QUÉ, no solo el hecho: sin la razón, subir menos de lo reportado suena arbitrario.
    return {
      error: null,
      success: null,
      warning: `Registramos que recibiste ${reported}. Tu inventario sube ${balanceApplied} porque es lo que CNV declaró haber enviado; si de verdad llegaron ${reported}, CNV lo confirma y ajusta. Las ${difference} de más quedan registradas para que CNV las revise.`,
    };
  }
  // Faltó (incluye confirmar 0 = no llegó nada). Sin acusar: aún no se sabe si se perdieron en transporte.
  if (reported === 0) {
    return {
      error: null,
      success: null,
      warning: `Registramos que no llegó nada de las ${declared} que CNV declaró. La remesa queda como faltante total, reportada.`,
    };
  }
  return {
    error: null,
    success: null,
    warning: `Registramos que llegaron ${reported} de las ${declared} que CNV declaró. Tu inventario sube ${balanceApplied}. La diferencia queda reportada.`,
  };
}

// Registrar un CONTEO fisico (T3b-3 ST2, Mi inventario). Solo el profesional (canLoadOwnStock). El conteo
// se registra SIEMPRE (evidencia); si hay faltantes, abre casos. El aviso resume que paso.
export async function recordCountFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional registra el conteo de su inventario.", success: null, warning: null };
  }
  let parsedLines: unknown;
  try {
    parsedLines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    parsedLines = undefined;
  }
  const parsed = recordCountSchema.safeParse({
    note: optStr(formData, "note"),
    lines: parsedLines,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos del conteo invalidos.", success: null, warning: null };
  }

  // FUERA DE LA VENTANA SE RECHAZA, y el mensaje dice CUANDO le toca (0208). El error viene del escritor,
  // que es quien conoce la regla; aqui solo se traduce a `Result` en vez de dejarlo subir como excepcion.
  let res;
  try {
    res = await inventoryService.recordOwnCount(
      user.id,
      parsed.data.lines.map((l) => ({ nutraceuticalId: l.nutraceuticalId, lote: l.lote ?? null, physicalQty: l.physicalQty })),
      parsed.data.note ?? null,
    );
  } catch (e) {
    const { ConteoFueraDeVentanaError } = await import("./data/count-writer");
    if (e instanceof ConteoFueraDeVentanaError) {
      return { error: e.message, success: null, warning: null };
    }
    throw e;
  }
  if (!res) return { error: "No tienes un perfil profesional.", success: null, warning: null };

  revalidatePath("/mi-inventario");
  // Si abrio casos, es un aviso (hay faltantes que atender); si no, confirmacion simple.
  if (res.opened.length > 0) {
    const sob = res.sobrantes.length > 0 ? ` Y ${res.sobrantes.length} sobrante(s) por revisar.` : "";
    return {
      error: null,
      success: null,
      warning: `Conteo registrado. Se abrieron ${res.opened.length} caso(s) de faltante (esperan justificación).${sob}`,
    };
  }
  const sob = res.sobrantes.length > 0 ? ` ${res.sobrantes.length} sobrante(s) por revisar.` : "";
  return { error: null, success: `Conteo registrado: todo cuadró.${sob}`, warning: null };
}

// Enviar la JUSTIFICACION de un faltante (T3b-3 ST3). Solo el profesional; el service verifica ademas que
// el caso sea suyo, que este en reportado y dentro del plazo. La referencia es obligatoria (schema).
export async function submitJustificationFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional justifica sus faltantes.", success: null, warning: null };
  }
  const parsed = submitJustificationSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    category: String(formData.get("category") ?? ""),
    reference: String(formData.get("reference") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos de la justificación invalidos.", success: null, warning: null };
  }
  const res = await faltanteService.submitJustification({
    userId: user.id,
    caseId: parsed.data.caseId,
    category: parsed.data.category,
    reference: parsed.data.reference,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo enviar la justificación.", success: null, warning: null };
  // Sin revalidate: el caso deja "por justificar" y el formulario se desmonta; el cliente avisa y refresca.
  return { error: null, success: "Justificación enviada. CNV la revisará.", warning: null };
}

// CNV clasifica un faltante (T3b-3 ST4). Solo admin (canClassifyFaltante). "injustificado" PROPONE, no cobra.
export async function classifyFaltanteFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canClassifyFaltante(user)) {
    return { error: "Solo un administrador clasifica los faltantes.", success: null, warning: null };
  }
  const parsed = classifyFaltanteSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    reason: optStr(formData, "reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const res = await faltanteService.classifyFaltante({
    userId: user.id,
    caseId: parsed.data.caseId,
    decision: parsed.data.decision,
    reason: parsed.data.reason ?? null,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo clasificar.", success: null, warning: null };
  // Sin revalidate: el caso deja "por revisar" y el formulario se desmonta; el cliente muestra el aviso y refresca.
  const msg =
    parsed.data.decision === "injustificado"
      ? "Propuesto como injustificado. Espera la confirmación de dirección para que el cargo aplique."
      : "Caso cerrado sin cargo.";
  return { error: null, success: msg, warning: null };
}

// Direccion confirma o rechaza la propuesta de injustificado (T3b-3 ST4). Solo direccion. Confirmar
// materializa el cargo; rechazar lo cierra sin cargo.
export async function confirmFaltanteFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canConfirmFaltante(user)) {
    return { error: "Solo dirección confirma un cargo por faltante.", success: null, warning: null };
  }
  const parsed = confirmFaltanteSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    reason: optStr(formData, "reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const res = await faltanteService.confirmFaltante({
    userId: user.id,
    caseId: parsed.data.caseId,
    decision: parsed.data.decision,
    reason: parsed.data.reason ?? null,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo confirmar.", success: null, warning: null };
  // Sin revalidate: el caso deja "esperando confirmación" y el formulario se desmonta; el cliente avisa y refresca.
  return {
    error: null,
    success: parsed.data.decision === "confirmar" ? "Cargo confirmado: entra en la liquidación del período." : "Propuesta rechazada: el caso queda sin cargo.",
    warning: null,
  };
}

// Resolver un SOBRANTE (T3b-3 ST5). Solo admin. Motivo obligatorio; sube el saldo con una conciliacion.
export async function resolveSobranteFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canResolveSobrante(user)) {
    return { error: "Solo un administrador resuelve los sobrantes.", success: null, warning: null };
  }
  const parsed = resolveSobranteSchema.safeParse({
    countLineId: String(formData.get("countLineId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const res = await faltanteService.resolveSobrante({ userId: user.id, countLineId: parsed.data.countLineId, reason: parsed.data.reason });
  if (!res.ok) return { error: res.message ?? "No se pudo resolver el sobrante.", success: null, warning: null };
  // Sin revalidate: el sobrante deja la lista y el formulario se desmonta; el cliente avisa y refresca.
  return { error: null, success: "Sobrante resuelto: el saldo se ajustó con el motivo registrado.", warning: null };
}

// El Integrante marca que VIO la alerta de vencimiento de un lote (0186). Es el unico dato de esa fila que se
// guarda por declaracion, porque es el unico que el sistema no puede deducir: que el lote se atendio lo dice
// el saldo. La fecha es write-once (trigger): moverla hacia adelante favoreceria a quien quiera discutir el
// cargo, asi que la primera vez es la que cuenta.
export async function marcarVencimientoVistoFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional marca sus propias alertas.", success: null, warning: null };
  }
  const parsed = marcarVencimientoVistoSchema.safeParse({ alertaId: String(formData.get("alertaId") ?? "") });
  if (!parsed.success) return { error: "Alerta invalida.", success: null, warning: null };

  const marcada = await vencimientosLectura.marcarAlertaVista(user.id, parsed.data.alertaId);
  if (!marcada) {
    return { error: "Esa alerta no es tuya o ya estaba marcada.", success: null, warning: null };
  }
  // Sin revalidate: la pantalla refresca desde el cliente (`useFormToastAndRefresh`). Las dos cosas a la vez
  // es el defecto de "refresco una sola vez".
  return { error: null, success: "Queda registrado que viste la alerta.", warning: null };
}

// CNV completa el vencimiento de un lote PROVISIONAL (0186). Solo admin (canManageCatalog): es el dato del
// que cuelga la alerta y, con ella, quien asume un vencido. Solo alcanza a los provisionales; el vencimiento
// de un lote confirmado no se re-escribe desde una pantalla.
export async function completarVencimientoFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const { error } = await requireCatalogManager();
  if (error) return { error: error.message, success: null, warning: null };

  const parsed = completarVencimientoSchema.safeParse({
    lotId: String(formData.get("lotId") ?? ""),
    vence: String(formData.get("vence") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const listo = await vencimientosLectura.completarVencimiento(parsed.data.lotId, parsed.data.vence);
  if (!listo) return { error: "Ese lote ya no estaba provisional.", success: null, warning: null };
  // Sin revalidate: el lote deja la lista y el formulario se desmonta; el cliente avisa y refresca.
  return { error: null, success: "Vencimiento registrado: ese lote ya entra en la alerta.", warning: null };
}

// EL INTEGRANTE DECLARA una devolucion a CNV (0187). No mueve saldo: el saldo baja cuando CNV confirma lo
// que recibio. Declarar y confirmar no pueden ser la misma persona, que es lo que impediria vaciar un saldo
// por la sola palabra de su custodio.
export async function declararDevolucionFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional declara devoluciones de su propia vitrina.", success: null, warning: null };
  }
  const parsed = declararDevolucionSchema.safeParse({
    lotId: String(formData.get("lotId") ?? ""),
    nutraceuticalId: String(formData.get("nutraceuticalId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const res = await devolucionService.declararMiDevolucion({
    userId: user.id,
    lotId: parsed.data.lotId,
    nutraceuticalId: parsed.data.nutraceuticalId,
    quantity: parsed.data.quantity,
    reason: parsed.data.reason,
  });
  if (!res.ok) return { error: res.message, success: null, warning: null };
  // Sin revalidate: la pantalla refresca desde el cliente (`useFormToastAndRefresh`).
  return {
    error: null,
    // SE DICE QUE EL SALDO NO BAJO TODAVIA, para que no crea que ya se descontó y le extrañe su propio conteo.
    success: "Devolución declarada. Tu saldo baja cuando CNV confirme lo que recibió.",
    warning: null,
  };
}

// CNV CIERRA la devolucion con lo recibido (0187). Ahi si se mueve el saldo: sale de su vitrina y entra a la
// bodega central, en la misma transaccion.
export async function cerrarDevolucionFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canCerrarDevolucion(user)) {
    return { error: "Solo CNV confirma lo que recibió.", success: null, warning: null };
  }
  const parsed = cerrarDevolucionSchema.safeParse({
    returnId: String(formData.get("returnId") ?? ""),
    recibido: String(formData.get("recibido") ?? ""),
    nota: String(formData.get("nota") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const res = await devolucionService.cerrarUnaDevolucion({
    returnId: parsed.data.returnId,
    recibido: parsed.data.recibido,
    nota: parsed.data.nota?.trim() ? parsed.data.nota.trim() : null,
    actorId: user.id,
    actorEmail: user.email ?? null,
    ip: null,
  });
  if (!res.ok) return { error: res.message, success: null, warning: null };
  return {
    error: null,
    success:
      res.movidas === 0
        ? "Cerrada sin recibir nada: las unidades siguen en el saldo del Integrante."
        : `Recibidas ${res.movidas}: salieron de su vitrina y entraron a la bodega central.`,
    warning: null,
  };
}

// ── ADMIN LE ABRE EL CONTEO A UN INTEGRANTE, fuera del calendario (0208) ────────────────────────────
//
// EL MOTIVO ES OBLIGATORIO Y SE LE MUESTRA. Abrirle un conteo es pedirle trabajo y puede terminar en un caso
// de faltante con consecuencia economica: una peticion sin explicacion se lee como una acusacion.
export type AperturaDeConteoState = { error: string | null; success: string | null; warning: string | null };

export async function abrirElConteoFormAction(
  _prev: AperturaDeConteoState,
  formData: FormData,
): Promise<AperturaDeConteoState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  // LA MISMA POLICY QUE VE LA COLA DE FALTANTES (admin o direccion): quien mira las diferencias de conteo es
  // quien puede pedir que se cuente. Una policy nueva para esto seria una segunda respuesta a la misma
  // pregunta, y la segunda es la que se queda desactualizada.
  if (!canSeeFaltanteQueue(user)) {
    return { error: "Solo CNV puede pedirle un conteo a un Integrante.", success: null, warning: null };
  }

  const professionalId = String(formData.get("professionalId") ?? "").trim();
  const hasta = String(formData.get("hasta") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!professionalId || !hasta) {
    return { error: "Falta el Integrante o la fecha.", success: null, warning: null };
  }

  const { abrirElConteo, AperturaDeConteoError } = await import("./data/count-writer");
  try {
    await abrirElConteo({ professionalId, hasta, motivo, actorId: user.id, actorEmail: user.email });
  } catch (e) {
    if (e instanceof AperturaDeConteoError) return { error: e.message, success: null, warning: null };
    throw e;
  }

  // SIN `revalidatePath`, y no es un olvido: la pantalla refresca por `useFormToastAndRefresh`, y los dos
  // ciclos juntos montan los segmentos dos veces (la pagina salta al inicio dos veces y el formulario puede
  // desmontarse antes de que se vea el toast). Lo atrapo el candado `refresco-una-sola-vez`, por segunda vez
  // y por el mismo motivo que el 2026-10-04 con la marca de profesional.
  return {
    error: null,
    success: `Le pediste el conteo. Puede registrarlo hasta el ${hasta}, y verá la razón que escribiste.`,
    warning: null,
  };
}
