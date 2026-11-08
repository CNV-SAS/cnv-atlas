// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ¿SE CORRIGIO LA FECHA DE NACIMIENTO DESPUES DE EMITIR ESTE DIAGNOSTICO?  ·  0244, 2026-11-08
//
// ═══ POR QUE ES UNA SEGUNDA PUERTA, Y NO UNA DIMENSION MAS DE `vigenciaEmision` ═══
//
// `vigenciaEmision` contesta *"¿este documento se emitio con la ciencia que rige hoy?"*. Aqui la ciencia
// puede ser exactamente la misma: lo que cambio es un INSUMO del paciente. Meterlo ahi como una
// "dimension desfasada" diria que la ciencia se movio, que es falso, y ensuciaria el aviso que el
// profesional ve en su pantalla ("emitido con una version anterior del modelo").
//
// Son dos razones distintas para reemitir y la pantalla las dice distinto. Lo que SI tiene que ser uno es
// el criterio, y por eso vive aqui: la pantalla de recalibracion OFRECE lo que el guard de la reemision
// ACEPTA, y escribirlo dos veces es como ya divergieron una vez (ver la nota del 2026-11-07 en
// `desfasadas-reader`).
//
// ═══ POR QUE "DESPUES DE EMITIR" Y NO "ALGUNA VEZ" ═══
//
// Una correccion ANTERIOR al diagnostico ya entro en el calculo: ese diagnostico se emitio con la fecha
// buena y no hay nada que rehacer. Solo la correccion POSTERIOR deja un documento sellado con una edad
// que hoy sabemos equivocada. Comparar contra la fecha del diagnostico VIGENTE (la ultima fila) es lo que
// hace que reemitir CIERRE el caso: una vez reemitido, la correccion queda detras y la consulta sale de
// la pantalla sola, sin marca que acordarse de apagar.
//
// ═══ MODULO NEUTRO Y SIN FECHAS DE NACIMIENTO EN EL TEXTO ═══
//
// Neutro (sin `server-only` ni `"use client"`) porque lo usan el lector del servidor y el guard, y el
// texto que produce lo pinta un componente cliente. Y el texto NO lleva las dos fechas a proposito: la
// pantalla de recalibracion es una operacion sobre el historico, SIN datos de paciente, y una fecha de
// nacimiento lo es. El par (anterior, nueva) vive en su tabla, que es admin y append-only.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Lo unico que hace falta de cada correccion para decidir: cuando se hizo. */
export type CorreccionDeFecha = { creadaEn: string };

/**
 * Devuelve el motivo en una frase, o `null` si no hay ninguna correccion posterior.
 *
 * `selladoEn` es el `created_at` del diagnostico VIGENTE. Si llega nulo no se afirma nada: sin saber
 * cuando se emitio, decir que la correccion fue despues seria inventarlo.
 */
export function fechaCorregidaDespuesDeEmitir(
  correcciones: CorreccionDeFecha[],
  selladoEn: string | null,
): string | null {
  if (!selladoEn) return null;
  const sello = new Date(selladoEn).getTime();
  if (Number.isNaN(sello)) return null;

  let ultima: number | null = null;
  for (const c of correcciones) {
    const t = new Date(c.creadaEn).getTime();
    if (Number.isNaN(t) || t <= sello) continue;
    if (ultima === null || t > ultima) ultima = t;
  }
  if (ultima === null) return null;
  return `fecha de nacimiento corregida el ${new Date(ultima).toISOString().slice(0, 10)}, después de emitirlo`;
}
