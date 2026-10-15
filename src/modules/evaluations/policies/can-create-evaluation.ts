import type { MotivoDeRegularizacion } from "@/modules/consent/regularizacion";
import { type ConsentType, NECESSARY_CONSENT_TYPES } from "@/modules/consent/validations";

// Gate de consentimiento (regla dura 15). Es el unico hogar de la regla: no se crea
// ninguna evaluacion sin las 3 autorizaciones necesarias vigentes (servicio,
// datos_sensibles, internacional_ia; revoked_at IS NULL). Aplica al intake inicial
// y al de seguimiento. Se verifica ANTES de insertar la evaluacion, nunca despues.
//
// ═══ Y DESDE LA PIEZA 2, UN SEGUNDO INSUMO: QUE LAS TRES SIRVAN (legal, 2026-10-09) ═══
//
// TENER LAS TRES NO ES LO MISMO QUE TENERLAS VALIDAS. Un menor que consintio sin representante tiene las
// tres vigentes y ninguna la otorgo quien podia otorgarla. Textual del dictamen: *"hay que asegurar que
// 'valido' excluya los consentimientos de menor sin representante."*
//
// EL SEGUNDO INSUMO ES OBLIGATORIO Y NO OPCIONAL, a proposito: con un parametro opcional, un lector nuevo
// que lo olvidara seguiria compilando y volveria a dejar pasar el caso en silencio. Asi el compilador
// obliga a CONTESTAR, y quien decida no mirarlo pasa `null` con su razon escrita al lado. Es la leccion de
// la bandera ignorada ([[una-bandera-ignorada-deja-creer-que-se-aplico]]).
//
// LA DERIVACION DEL MOTIVO NO VIVE AQUI sino en `modules/consent/regularizacion`, que es puro y no sabe de
// evaluaciones: aqui se decide que hacer con el, que es otra pregunta.

export type ConsentGateResult =
  | { ok: true }
  | {
      ok: false;
      /** Autorizaciones necesarias que faltan. Vacio cuando las tiene todas pero no sirven. */
      missing: ConsentType[];
      /** Lo que impide evaluar aunque tenga las tres. Null cuando el problema son las que faltan. */
      regularizar: MotivoDeRegularizacion | null;
    };

/**
 * @param activeConsentTypes los `consent_type` del paciente con `revoked_at IS NULL`.
 * @param pendienteDeRegularizar lo que devuelve `motivoDeRegularizacion`, o `null` si no aplica (o si
 *        quien llama decide a proposito no mirarlo, y entonces escribe por que).
 */
export function canCreateEvaluation(
  activeConsentTypes: readonly ConsentType[],
  pendienteDeRegularizar: MotivoDeRegularizacion | null,
): ConsentGateResult {
  const active = new Set(activeConsentTypes);
  const missing = NECESSARY_CONSENT_TYPES.filter((t) => !active.has(t));
  if (missing.length > 0) return { ok: false, missing, regularizar: null };
  // SOLO FRENA EL MOTIVO QUE DICE QUE FRENA. Los otros son avisos para que alguien mire (una fecha mal
  // digitada, una rama que cambio al corregirla): pararle la atencion a un paciente por un dato que su
  // profesional puede arreglar en dos clics seria mas daño que el que se evita.
  if (pendienteDeRegularizar?.frenaEvaluaciones) {
    return { ok: false, missing: [], regularizar: pendienteDeRegularizar };
  }
  return { ok: true };
}
