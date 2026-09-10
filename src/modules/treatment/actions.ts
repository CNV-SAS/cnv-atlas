"use server";

import { getClientIp } from "@/core/http/client-ip";
import { limitAiMenuByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { generateMenu } from "./services/generate-menu";
import {
  canAcknowledgeRestrictions,
  canEmitirPrescripcion,
} from "./policies/can-edit-protocol";
import { canManageTreatment } from "./policies/can-manage-treatment";
import {
  acknowledgeRestrictions,
  addNote,
  aplicarCambioMenu,
  aplicarCambiosMenu,
  emitirPrescripcion,
  guardarProtocolo,
  saveNutraceuticals,
  saveNutraDecision,
} from "./services/treatment-service";
import {
  acknowledgeRestrictionsSchema,
  addNoteSchema,
  aplicarCambioMenuSchema,
  aplicarCambiosMenuSchema,
  emitirPrescripcionSchema,
  guardarProtocoloSchema,
  saveNutraceuticalsSchema,
  saveNutraDecisionSchema,
} from "./validations";

// Actions del protocolo de tratamiento (B13). Thin (regla 2): autorizan por policy,
// parsean/validan con Zod y delegan en el service. Los arreglos (restricciones,
// nutraceuticos, guias) viajan como JSON en el formulario y se parsean aqui.

export type TreatmentActionState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

const fail = (error: string): TreatmentActionState => ({ error, success: null, warning: null });

function parseJsonArray(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return undefined; // fuerza el fallo de validacion aguas abajo
  }
}


async function actor() {
  const ip = await getClientIp();
  return { ip: ip === "unknown" ? null : ip };
}

// CP-N1: la decision sobre los nutraceuticos, su propia accion.
export async function saveNutraDecisionAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = saveNutraDecisionSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    decision: (form.get("decision") as string | null) ?? "",
    reason: (form.get("reason") as string | null) || null,
    note: (form.get("note") as string | null) || null,
    contraindicationFor: (form.get("contraindicationFor") as string | null) || null,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Decisión inválida.");
  }

  const result = await saveNutraDecision(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);
  // NO se revalida: el componente ya refresca con useFormToastRefreshOnSuccess, asi que este
  // revalidatePath era REDUNDANTE, y ademas es el que arrastraba la pagina al inicio al pulsar
  // "Registrar decisión" (revalidar una ruta la trata como navegacion; router.refresh preserva el
  // scroll). El sintoma "la primera vez salta y la segunda no" es que salta SIEMPRE: la segunda vez ya
  // se esta arriba. Verificado sobre esta accion, que es una de las cuatro que hacian las dos cosas.
  return { error: null, success: "Decisión registrada.", warning: null };
}

// Aplica UN cambio propuesto por la IA a la grilla. Cambio por cambio; el global es aparte.
//
// DEVUELVE ESTADO, Y ESO ES UN ARREGLO, no una preferencia de forma. Hasta el 2026-08-31 esta accion era
// `Promise<void>` y DESCARTABA el Result del service: si el candado de concurrencia rechazaba el guardado
// (otra sesion escribio entretanto), no pasaba absolutamente nada en pantalla y el profesional se quedaba
// creyendo que habia aplicado el cambio. Un fallo silencioso en una escritura clinica es peor que un error
// visible. Ahora el rechazo del candado sale como warning, con su mensaje, igual que en el guardado manual.
//
// Y NO REVALIDA: el refresco lo hace el cliente DESPUES de disparar el aviso (useFormToastAndRefresh). Un
// `revalidatePath` aqui arrastraba la pagina al inicio en cada clic, que es lo que Santiago reporto en el
// smoke, y ademas desmontaba el formulario antes de que el aviso se viera.
export async function aplicarCambioMenuAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = aplicarCambioMenuSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    dia: Number(form.get("dia")),
    tiempo: (form.get("tiempo") as string | null)?.trim() ?? "",
    reemplazo: (form.get("reemplazo") as string | null) ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Cambio inválido.");

  const result = await aplicarCambioMenu(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  return { error: null, success: "Cambio aplicado a la grilla.", warning: null };
}

// Aplica TODAS las sustituciones de una propuesta. El atajo, no la unica via: los botones individuales
// siguen ahi, asi que esto ahorra clics sin obligar a aceptar nada en bloque (Santiago, 2026-08-31).
//
// UN SOLO GUARDADO para todas (ver `aplicarCambiosMenu`): un bucle sobre el de a uno invalidaria su propia
// firma en la segunda escritura y dejaria la grilla aplicada a medias.
export async function aplicarCambiosMenuAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  // Los cambios viajan como JSON en un hidden: son una lista de objetos, y un FormData plano no la
  // representa sin inventar una convencion de nombres que habria que parsear igual.
  let cambios: unknown = [];
  try {
    cambios = JSON.parse((form.get("cambios") as string | null) ?? "[]");
  } catch {
    return fail("No se pudieron leer los cambios.");
  }

  const parsed = aplicarCambiosMenuSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    cambios,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Cambios inválidos.");

  const result = await aplicarCambiosMenu(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }
  const n = parsed.data.cambios.length;
  return {
    error: null,
    success: n === 1 ? "Cambio aplicado a la grilla." : `${n} cambios aplicados a la grilla.`,
    warning: null,
  };
}

// Checkpoint 2.4: guias dietarias, su propia accion.

// Checkpoint 2.3: prescripcion de nutraceuticos, su propia accion (partida de saveProtocolAction). Mismo
// patron que saveAdjustmentsAction: candado, firma de remonte, y stale_write como aviso que preserva la edicion.
export async function saveNutraceuticalsAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = saveNutraceuticalsSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    nutraceuticals: parseJsonArray(form.get("nutraceuticals")),
    baseSignature: (form.get("baseSignature") as string | null) ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Prescripción inválida.");
  }

  const result = await saveNutraceuticals(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }

  // NO se revalida aqui: la seccion se remonta por su `key` (nutraceuticalsSignature) y el refresh lo dispara
  // el hook useFormToastRefreshOnSuccess DESPUES del toast (mismo motivo que en la cadena/el protocolo).
  return { error: null, success: "Prescripción guardada.", warning: null };
}

export async function addNoteAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const parsed = addNoteSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    note: (form.get("note") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Nota inválida.");
  }

  const result = await addNote(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  // NO REVALIDA: el refresco lo hace el cliente tras disparar el aviso (useFormToastAndRefresh). Un
  // revalidate aqui arrastra la pagina al inicio y desmonta el form antes de que el aviso se vea.
  return { error: null, success: "Nota agregada.", warning: null };
}

// T2 A2: reconocimiento de las restricciones del modelo. PROFESIONAL-SOLO (acto clinico).
export async function acknowledgeRestrictionsAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canAcknowledgeRestrictions(user)) return fail("No autorizado.");

  const parsed = acknowledgeRestrictionsSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Evaluación inválida.");
  }

  const result = await acknowledgeRestrictions(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  // NO REVALIDA: el refresco lo hace el cliente tras disparar el aviso (useFormToastAndRefresh). Un
  // revalidate aqui arrastra la pagina al inicio y desmonta el form antes de que el aviso se vea.
  return { error: null, success: "Restricciones reconocidas.", warning: null };
}

// `reopenProtocolAction` SE RETIRO (2026-09-09). Existia para deshacer el cierre que provocaba aprobar, y
// ya no hay cierre: la prescripcion esta siempre abierta. El motivo obligatorio que exigia era el precio
// de ese cierre, no una garantia por si mismo; lo que si era una garantia (que no se pierda lo que el
// paciente recibio) lo sostiene ahora la copia inmutable de cada emision.

/**
 * IMPRIMIR EL PLAN REGISTRA LA ENTREGA (Santiago, 2026-09-09).
 *
 * QUE SUSTITUYE. Habia un boton aparte, "Entregado en consulta", que SELLABA la prescripcion: a partir de
 * ahi quedaba bloqueada y corregir una coma exigia reabrirla con un motivo escrito. Santiago lo reporto
 * como confuso, y tenia razon: eran tres cosas que el profesional sufre (un boton que parece un tramite,
 * una prescripcion cerrada y una reapertura con motivo) para conseguir UNA que si importa, saber que
 * recibio el paciente.
 *
 * POR QUE AHORA SI LO HACE LA IMPRESION, cuando antes se argumento lo contrario. El argumento de entonces
 * era: "imprimir es LEER; se imprime para revisar, y dos veces si salio torcida; convertir una lectura en
 * una firma es lo contrario de lo que un acto clinico debe ser". Ese argumento era correcto MIENTRAS
 * emitir CERRARA. Ahora emitir solo REGISTRA: la prescripcion sigue abierta, y dos impresiones dejan dos
 * lineas que dicen la verdad ("se imprimio dos veces"). La objecion se disuelve justamente porque la
 * pieza que la causaba ya no esta.
 *
 * LO QUE NO SE PUEDE SABER, y se dice para que nadie lo lea como mas de lo que es: `window.print()` no
 * informa de si el profesional acabo imprimiendo o cancelo el dialogo. Asi que esto registra que el plan
 * SE MANDO A IMPRIMIR. Es la afirmacion que el sistema puede sostener, y por eso es la que se escribe.
 */
export async function registrarPlanImpresoAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canEmitirPrescripcion(user)) return fail("No autorizado.");

  const parsed = emitirPrescripcionSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Evaluación inválida.");

  const result = await emitirPrescripcion(
    parsed.data,
    { actorId: user.id, actorEmail: user.email, ...(await actor()) },
    "impresa",
  );
  if (!result.ok) {
    // EL MENSAJE DICE COMO REINTENTAR. No hay boton propio para esto (ese era el que confundia), asi que
    // la via de reintento es volver a imprimir, y el texto tiene que nombrarla o el profesional se queda
    // sin saber que hacer con el aviso.
    return fail(`El plan se imprimió, pero no se pudo registrar la entrega: ${result.error.message} Vuelve a imprimirlo para que quede constancia.`);
  }

  return {
    error: null,
    success: "Entrega registrada. La prescripción sigue abierta: puedes seguir ajustándola.",
    warning: null,
  };
}

// `approveProtocolAction` y `marcarEntregadoEnConsultaAction` SE RETIRARON (2026-09-09). La primera era el
// boton "Aprobar la prescripcion" y la segunda "Entregado en consulta"; ninguna de las dos tiene ya
// sentido, porque no existe un acto suelto de sellar. Las DOS vias de emision son actos que el profesional
// hace de todos modos: IMPRIMIR el plan (aqui arriba) y ENVIAR el reporte (que llama a `emitirPrescripcion`
// en su servicio). Se retiran en vez de dejarlas: una accion sin pantalla es la tercera forma de cable
// suelto, y `check:cables` la habria marcado.

// Genera el menu por IA desde los objetivos guardados del protocolo (barrera PII en el
// service). Rate limit por usuario: cada generacion es una llamada externa paga.
export async function generateMenuAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluación inválida.");

  const rl = await limitAiMenuByUser(user.id);
  if (!rl.success) return fail("Has generado demasiados menus. Espera unos minutos.");

  const result = await generateMenu(evaluationId, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) return fail(result.error.message);

  // NO REVALIDA: el refresco lo hace el cliente tras disparar el aviso (useFormToastAndRefresh). Un
  // revalidate aqui arrastra la pagina al inicio y desmonta el form antes de que el aviso se vea.
  // TRES DESENLACES DISTINTOS, y decirlos distinto importa: "no habia nada que adaptar" NO es lo mismo que
  // "la IA fallo" ni que "hay propuestas para revisar". Un solo mensaje para los tres dejaria al
  // profesional sin saber si tiene que mirar algo.
  if (result.value.status === "sin_restricciones") {
    return {
      error: null,
      success: null,
      warning:
        "Este paciente no tiene restricciones registradas, así que no hay nada que adaptar: el menú del ciclo es el que aplica.",
    };
  }
  if (result.value.status !== "success") {
    return {
      error: null,
      success: null,
      warning: "No se pudo adaptar el menú. La grilla se queda con el menú del ciclo, que sigue siendo válido.",
    };
  }
  return { error: null, success: "Revisa las sustituciones propuestas y aplica las que apruebes.", warning: null };
}


// ═══ UN SOLO GUARDADO PARA TODO EL PROTOCOLO (Santiago, 2026-09-09) ═══
//
// SUSTITUYE A SIETE ACCIONES, y el payload viaja como UN json en vez de siete campos sueltos: la pantalla
// ya tiene el borrador entero en memoria, asi que serializarlo entero es una linea y no siete.
//
// EL PARSEO ES TOLERANTE CON LA FORMA Y ESTRICTO CON EL CONTENIDO: si el json no llega o no parsea, se
// rechaza con un mensaje legible en vez de reventar; lo que valida las reglas clinicas (los 21 alimentos,
// al menos un tiempo activo, los topes de texto) es el schema, que reusa los de cada seccion.
export async function guardarProtocoloAction(
  _prev: TreatmentActionState,
  form: FormData,
): Promise<TreatmentActionState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return fail("No autorizado.");

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(String(form.get("protocolo") ?? "null"));
  } catch {
    return fail("No se pudo leer lo que hay en pantalla. Recarga e inténtalo de nuevo.");
  }

  const parsed = guardarProtocoloSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    ...(cuerpo as Record<string, unknown>),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Hay un valor inválido en el protocolo.");
  }

  const result = await guardarProtocolo(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ...(await actor()),
  });
  if (!result.ok) {
    // stale_write como AVISO y no como error: preserva la edicion en pantalla para que se pueda reaplicar.
    if (result.error.code === "stale_write") {
      return { error: null, success: null, warning: result.error.message };
    }
    return fail(result.error.message);
  }

  // EL MENSAJE DERIVA DE LO QUE SE ESCRIBIO, no de que la accion no fallara. Decir "guardado" cuando no
  // cambio nada le haria creer al profesional que dejo un registro que no existe, y ademas le quitaria la
  // unica pista de que su cambio no llego (por ejemplo, si el borrador se remonto y perdio lo escrito).
  const n = result.value.guardadas.length;
  if (n === 0) {
    return { error: null, success: "No había cambios que guardar.", warning: null };
  }
  return {
    error: null,
    success:
      n === 1
        ? `Se guardó ${result.value.guardadas[0]}.`
        : `Se guardaron ${n} secciones: ${result.value.guardadas.join(", ")}.`,
    warning: null,
  };
}
