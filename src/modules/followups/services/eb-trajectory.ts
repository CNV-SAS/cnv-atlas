// P0 Parte 2: el CAMBIO de la EB-BIS entre mediciones, mostrado al PACIENTE en tres bandas (mejoró /
// sin cambio / empeoró), NO el nivel ni la cifra. Núcleo PURO y testeable; el cableado a datos (elegir
// la previa comparable) y al reporte va aparte.
//
// DISENO CLAVE (requisito de Santiago): la banda es un DATO disponible ANTES de generar el reporte, no
// algo que aparece dentro del PDF ya armado. Asi, si Gildardo decide que "empeoró" exige que el
// profesional lo RECONOZCA antes de aprobar el reporte (como el ack de restricciones del menú o la
// confirmación del diagnóstico), ese gate se cablea sin rehacer nada: la banda ya es un valor que el
// flujo de aprobación puede mirar. Query registrada para Gildardo.
//
// REDACCION (de cara al paciente) = AUTORIA DE GILDARDO, no nuestra. Los textos de abajo son los
// VERBATIM que él entregó (Q25 / RESPUESTA_GILDARDO 7.1, 2026-08-03), copiados con su puntuación
// exacta: una coma movida sería una edición no autorizada de comunicación al paciente.

// Corte de banda en años. OPERATIVO/PROVISIONAL (decisión de Gildardo, P0): se reemplaza por el
// "cambio mínimo detectable" cuando exista. Vive aquí, en TS, NO en la ciencia congelada: cambiable
// sin tocar el motor.
// POR QUÉ SE SELLA junto a la banda en cada reporte (NO es redundante, no quitar): el día que este
// corte cambie, los reportes VIEJOS conservan su banda calculada con el corte anterior (no se
// reescribe lo emitido). Un profesional que compare dos reportes del mismo paciente podría ver bandas
// calculadas con criterios distintos; el `cutYears` sellado hace esa diferencia AUDITABLE (se puede
// reconstruir con qué corte se emitió cada banda). Sin el valor sellado, esa reconstrucción se pierde.
export const EB_CHANGE_BAND_YEARS = 2;

// Intervalo mínimo entre mediciones comparables (decisión de Gildardo, P0).
export const MIN_COMPARABLE_WEEKS = 12;


// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DOS VERSIONES MAYORES DEL MOTOR NO SE COMPARAN  (Santiago, 2026-10-24)
//
// ═══ EL DEFECTO, Y ESTABA VIVO ANTES DE LA v7 ═══
//
// La banda es una resta: `EB actual - EB previa`. La EB previa sale del snapshot SELLADO del reporte de esa
// evaluacion, que se calculo con el motor de ENTONCES. Nada miraba cual era ese motor, asi que el dia que la
// EB-BIS cambie de formula (la v7 de Gildardo la cambia) la resta se haria entre DOS ESCALAS DISTINTAS, y el
// resultado se le muestra AL PACIENTE como "mejoro" o "empeoro".
//
// ═══ EL CRITERIO NO ES NUESTRO: YA ESTABA ESCRITO ═══
//
// `docs/VERSIONES.md`: *"Mayor = la ciencia cambia y lo emitido antes no es comparable"*. O sea que la
// comparabilidad la define la version MAYOR, literalmente. 1.0.0 contra 1.4.0 se comparan (misma ciencia,
// mas cosas que el motor puede devolver); 1.x contra 2.x no.
//
// ═══ Y SI LA VERSION NO SE PUEDE LEER, NO SE COMPARA ═══
//
// Medido en produccion el 2026-10-24: los 406 reportes tienen su version sellada en el snapshot (400 en
// `1.0.0` y 6 en `anibise-1.4.0`, que es la grafia vieja del mismo mayor). Asi que "no se puede leer" no le
// pasa hoy a ninguna fila, y tratarlo como no comparable no suprime ninguna banda existente: lo que hace es
// que, si manana aparece un snapshot sin version, el sistema calle en vez de restar a ciegas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * La version MAYOR del motor, o null si no se puede leer.
 *
 * Tolera las dos grafias que hay en produccion (`1.0.0` y `anibise-1.4.0`) a proposito: unificarlas es otro
 * pendiente, y hasta que ocurra una banda no puede depender de cual se uso.
 */
export function mayorDelMotor(version: string | null | undefined): string | null {
  if (!version) return null;
  const m = /(\d+)\.\d+\.\d+/.exec(version);
  return m ? m[1] : null;
}

/** Dos resultados son comparables cuando los dos traen version y su MAYOR es el mismo. */
export function sonComparables(a: string | null | undefined, b: string | null | undefined): boolean {
  const ma = mayorDelMotor(a);
  const mb = mayorDelMotor(b);
  return ma != null && mb != null && ma === mb;
}

export type EbBand = "mejoro" | "sin_cambio" | "empeoro";

// EB más BAJA = más joven = mejor. delta = EB actual − EB previa: negativo = mejoró, positivo = empeoró.
export function ebBand(ebDelta: number, cutYears: number = EB_CHANGE_BAND_YEARS): EbBand {
  if (ebDelta <= -cutYears) return "mejoro";
  if (ebDelta >= cutYears) return "empeoro";
  return "sin_cambio";
}

// Texto de cara al PACIENTE por banda. VERBATIM de Gildardo (Q25 / RESPUESTA_GILDARDO 7.1, 2026-08-03):
// copiado con su puntuación exacta, no se edita (es su autoría de comunicación al paciente). No revela
// el constructo (no dice "edad bioeléctrica") ni el nivel ni la cifra. El de "empeoró" solo se emite
// tras el acto de confirmación del profesional y con próxima cita agendada (ver el flujo de aprobación).
export const BAND_TEXT: Record<EbBand, string> = {
  mejoro:
    "Los indicadores de tu evaluación muestran una evolución favorable respecto de tu medición anterior. Continúa con el plan acordado con tu profesional.",
  sin_cambio:
    "Tus indicadores se mantienen en un rango similar al de tu medición anterior, sin cambios significativos con la información disponible.",
  empeoro:
    "Tus indicadores muestran una evolución menos favorable que en tu medición anterior. Tu profesional revisará contigo el plan en la próxima consulta.",
};

export type EbTrajectory = {
  band: EbBand;
  ebDelta: number;
  cutYears: number; // el corte con el que se calculó la banda (se sella junto a la banda)
  comparedToEvaluationId: string;
  comparedToDate: string; // fecha de la medición comparable
  /**
   * LAS DOS VERSIONES DEL MOTOR DE LA RESTA, selladas junto a la banda (2026-10-24).
   *
   * Por la misma razon que `cutYears`: el dia que el motor suba de mayor, un reporte viejo tiene que poder
   * decir contra que se comparo. Sin esto, la unica forma de saberlo es volver a buscar los dos snapshots.
   */
  engineVersion: string | null;
  comparedToEngineVersion: string | null;
  intervalWeeks: number;
  provisional: true; // hoy siempre: la calibración de la EB-BIS es provisional (P0)
};

// Candidato: una evaluación anterior del paciente con diagnóstico compatible (EB sellada) y su fecha.
export type PriorEvaluation = {
  evaluationId: string;
  date: string;
  eb: number | null;
  /** La version del motor con la que se sello ESA EB (snapshot -> versions -> engine). */
  engineVersion: string | null;
};

// Semanas entre dos fechas ISO (>=0). Puro; el caller pasa las fechas selladas.
export function weeksBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return ms / (1000 * 60 * 60 * 24 * 7);
}

// Resultado de resolver la trayectoria. Distingue los DOS motivos de "sin banda", porque el profesional
// debe entender cuál es (punto 3): "no hay medición anterior" vs "la anterior es de hace <12 semanas".
// Si mide seguido y el paciente nunca ve el cambio, sin esta distinción parecería que el sistema falla.
export type TrajectoryResult =
  | { kind: "band"; trajectory: EbTrajectory }
  | { kind: "no_prior" } // no hay medición anterior comparable con EB sellada
  | { kind: "interval_too_short"; nearestWeeks: number } // hay previa con EB, pero a <12 semanas
  // HAY PREVIA CON EB, PERO DE OTRA VERSION MAYOR DEL MOTOR: la resta seria entre dos escalas distintas.
  // Se dice aparte porque NO se resuelve esperando, a diferencia del intervalo: hay que recalcular esa
  // evaluacion con el motor vigente (el flujo de correccion con trigger de recalibracion).
  | { kind: "otra_version_del_motor"; versionPrevia: string };

// Resuelve la trayectoria (3b): busca la anterior MAS RECIENTE cuyo intervalo a la actual sea >=12
// semanas, con EB sellada. Gate sobre el INTERVALO, no la posición: si la inmediata anterior esta a
// <12 semanas pero una mas vieja califica, se usa la mas vieja. `priors` ordenada de mas reciente a mas
// antigua. Si ninguna califica, dice POR QUÉ (no_prior / interval_too_short) para el aviso al profesional.
export function resolveTrajectory(
  currentDate: string,
  currentEb: number | null,
  priors: PriorEvaluation[],
  /**
   * La version del motor de la EB ACTUAL. OBLIGATORIA a proposito, sin valor por defecto: un defecto
   * `null` haria que el caller que la olvida deje de emitir bandas EN SILENCIO, y un caller que la olvida
   * con un defecto permisivo volveria a restar escalas distintas. Las dos salidas son peores que un error
   * de compilacion.
   */
  currentEngineVersion: string | null,
): TrajectoryResult {
  if (currentEb == null) return { kind: "no_prior" }; // sin EB actual no hay con qué comparar (degradado)

  // ── LA VERSION SE FILTRA ANTES QUE EL INTERVALO, y el orden importa ──
  //
  // Una previa de otro mayor NO es candidata, asi que no puede "ganar" el intervalo. Si se filtrara
  // despues, "interval_too_short" podria referirse a una previa que ademas era incomparable, y el aviso
  // mandaria al profesional a esperar doce semanas por una banda que no iba a salir nunca.
  const conEb = priors.filter((p) => p.eb != null);
  const comparables = conEb.filter((p) => sonComparables(currentEngineVersion, p.engineVersion));
  const descartadaPorVersion = conEb.find((p) => !sonComparables(currentEngineVersion, p.engineVersion));

  let mostRecentShortWeeks: number | null = null;
  for (const p of comparables) {
    if (p.eb == null) continue;
    const weeks = weeksBetween(p.date, currentDate);
    if (weeks < MIN_COMPARABLE_WEEKS) {
      if (mostRecentShortWeeks == null) mostRecentShortWeeks = weeks; // priors mas reciente primero
      continue;
    }
    const ebDelta = parseFloat((currentEb - p.eb).toFixed(1));
    return {
      kind: "band",
      trajectory: {
        band: ebBand(ebDelta),
        ebDelta,
        cutYears: EB_CHANGE_BAND_YEARS,
        comparedToEvaluationId: p.evaluationId,
        comparedToDate: p.date,
        engineVersion: currentEngineVersion,
        comparedToEngineVersion: p.engineVersion,
        intervalWeeks: Math.round(weeks),
        provisional: true,
      },
    };
  }
  // Hubo una previa con EB pero todas a <12 semanas: intervalo corto. Si no, no hay previa comparable.
  if (mostRecentShortWeeks != null) return { kind: "interval_too_short", nearestWeeks: Math.round(mostRecentShortWeeks) };
  // ── Y SI LA UNICA PREVIA CON EB ERA DE OTRO MOTOR, ESE ES EL MOTIVO, no "no hay previa" ──
  //
  // Decirle "no hay medicion anterior comparable" cuando SI la hay, y lo que pasa es que su EB se calculo
  // con otra ciencia, es una explicacion falsa de una pantalla: el profesional ve la consulta anterior
  // delante y el sistema le dice que no existe.
  if (descartadaPorVersion) {
    return {
      kind: "otra_version_del_motor",
      versionPrevia: descartadaPorVersion.engineVersion ?? "sin versión",
    };
  }
  return { kind: "no_prior" };
}

// Envoltorio: solo la trayectoria cuando hay banda (para los callers que no necesitan el motivo).
export function pickComparablePrior(
  currentDate: string,
  currentEb: number | null,
  priors: PriorEvaluation[],
  currentEngineVersion: string | null,
): EbTrajectory | null {
  const r = resolveTrajectory(currentDate, currentEb, priors, currentEngineVersion);
  return r.kind === "band" ? r.trajectory : null;
}
