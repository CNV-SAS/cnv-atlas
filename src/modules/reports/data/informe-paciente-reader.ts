import "server-only";

import type { RutaContent } from "@/clinical-engine/rutas-content";
import { remisionesExigidas } from "./hc-composicion";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listReferralsForTreatment } from "@/modules/referrals/data/referrals-reader";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

import { sinGuionLargo } from "@/lib/format/guion";

import { ultimaObservacionDeLaConsulta } from "./freno-de-trayectoria";
import type { InformeDelPaciente } from "./reports-view-types";

export type {
  InformeDelPaciente,
  RemisionDelInforme,
  RutaDelInforme,
  SuplementoIndicado,
} from "./reports-view-types";

// ═══ LO QUE EL INFORME DEL PACIENTE AÑADE AL PLAN (Santiago, 2026-09-19) ═══
//
// QUE PIDIO: que el documento que recibe el paciente lleve tambien las RUTAS con sus nutraceuticos y sus
// remisiones, diciendo QUE RECOMIENDA EL MODELO y QUE RECOMIENDA EL PROFESIONAL; y si el profesional no
// recomendo nada, que salga solo lo del modelo. Mas el seguimiento: la observacion de la consulta y la
// proxima cita.
//
// NO SE CONSTRUYE CONTENIDO, SE REUNE (Regla 0): las indicaciones son las de Gildardo, verbatim, desde el
// contenido de rutas CONGELADO en el snapshot del reporte; las remisiones salen del mismo derivador que
// ya alimenta la historia clinica (`remisionesExigidas`), y los suplementos del modelo son su cadena del
// mapa DX. Aqui solo se elige QUE se muestra y se le quita al paciente lo que no es suyo.
//
// ── Y LO QUE SE LE QUITA ES EL LENGUAJE DEL MODELO, que es una instruccion suya, no una preferencia ──
//
// Gildardo, §7.1: *"lo que hoy le mandan -IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el codigo N_N_N_A- NO
// DEBE SALIR ASI. Ningun indice del modelo va al paciente. Eso es el documento del profesional."*
//
// Y SU TEXTO DE RUTAS ESTA ESCRITO PARA EL PROFESIONAL: junto a "Omega-3 dietario: >=2 porciones pescado
// graso/semana" (que el paciente entiende y puede hacer) viene "Valoracion medica si IRC > 5.0 - descartar
// patologia inflamatoria subyacente" (que no es para el). Asi que se FILTRA por indice, no se reescribe:
// suprimir es representar menos, reescribir seria atribuirnos un cambio en su contenido clinico.
//
// LO QUE ESTO DEJA ABIERTO, y hay que preguntarselo a el: no existe una version de las rutas escrita para
// el paciente. La pregunta correcta no es "la redactamos?", es "por que no esta?", y se le hace a el.
//
// EL COMPONENTE MEDICO NO SALE COMO TEXTO, sale como REMISION (a quien acudir y con que urgencia): eso es
// lo accionable para el paciente, y su indicacion tecnica es justo la que nombra indices y paraclinicos.

/**
 * Los índices del modelo, con sus siglas. Una línea que nombre cualquiera de estos no viaja al paciente
 * tal cual: se le quita la condición y queda la acción.
 *
 * LA LISTA ES LA SUYA, COMPLETA (§7.1): IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, y las que el modelo añade
 * (FFMI, FMI, EB-BIS, IAE, DFI). Van también CMO y las abreviaturas clínicas que un paciente no lee
 * (HTA, DM2, TCA, TCC, FCmáx, P450), porque el criterio de fondo no es "índice del modelo": es que el
 * paciente entienda lo que le mandamos.
 *
 * LOS NOMBRES LARGOS NO ENTRAN A PROPÓSITO. "Aceleración del envejecimiento" se entiende y se queda; lo
 * que no puede salir es la CIFRA que la acompaña ("> 10 años"), y eso lo quita el corte de la condición,
 * no esta lista.
 */
const LENGUAJE_DEL_MODELO = [
  "IFC",
  "IRC",
  "PABU",
  "ICA-BIS",
  "ICABIS",
  "ISCM",
  "ISCM-BIS",
  "IEHH",
  "FFMI",
  "FMI",
  "EB-BIS",
  "EB",
  "IAE",
  "DFI",
  "BIS",
  "CMO",
  "HOMA-IR",
  "PCR",
  "HTA",
  "DM2",
  "TCA",
  "TCC",
  "FCmáx",
  "P450",
];

/** ¿Este texto nombra un índice o una abreviatura clínica? Se compara sobre palabras completas. */
function nombraUnIndice(texto: string): boolean {
  return LENGUAJE_DEL_MODELO.some((sigla) =>
    new RegExp(`(^|[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9-])${sigla}([^A-Za-zÁÉÍÓÚÑáéíóúñ0-9-]|$)`).test(texto),
  );
}

/**
 * Los separadores por los que una indicación suya parte en ACCIÓN + CONDICIÓN. Su contenido las escribe
 * así de forma consistente: "Valoración médica si IRC > 5.0, descartar patología...".
 */
const CONDICION = /\s+si\s+|\s*[,;:]\s*|\s+por\s+|\s+con\s+|\s+cuando\s+/i;

/**
 * Lo que de esta línea puede leer el paciente, o null si no queda nada que decirle.
 *
 * ── CÓMO SE DECIDIÓ (Santiago, 2026-09-19) ───────────────────────────────────────────────────────
 *
 * El filtro anterior DESCARTABA la línea entera si nombraba un índice, y eso tenía dos defectos: dejaba
 * pasar lo que venía en el campo de urgencia ("recomendada si IAE > 10 años", que es lo que él vio en el
 * informe), y donde sí actuaba, perdía la acción junto con la condición.
 *
 * LA REGLA AHORA ES: la acción sin la condición. "Valoración médica si IAE > 10 años" se convierte en
 * "Valoración médica". El paciente no necesita saber por qué se lo recomiendan: para eso está su
 * profesional, que tiene la línea completa en su pantalla.
 *
 * Y SI AL CORTAR NO QUEDA NADA, se devuelve null y la línea no sale. Eso no pierde ninguna remisión: las
 * remisiones no salen de aquí, salen de `remisionesExigidas` (a quién acudir y con qué urgencia).
 */
export function paraElPaciente(linea: string): string | null {
  const limpio = sinGuionLargo(linea).trim();
  if (!limpio) return null;
  if (!nombraUnIndice(limpio)) return limpio;

  const accion = limpio.split(CONDICION)[0]?.trim() ?? "";
  if (!accion || nombraUnIndice(accion)) return null;
  return accion;
}

/**
 * La urgencia de una remisión, dicha para el paciente: "recomendada", "obligatoria". Se le quita la
 * condición por lo mismo que a las indicaciones, y ADEMÁS se pone en minúscula, porque su archivo la
 * escribe en mayúsculas sostenidas ("OBLIGATORIA") y eso en un documento del paciente se lee como grito.
 *
 * null = no queda una palabra que el paciente entienda, y entonces la remisión sale sin urgencia: a quién
 * acudir es lo que no puede faltar.
 */
export function urgenciaParaElPaciente(urgencia: string | null): string | null {
  if (!urgencia) return null;
  // AQUI SE CORTA SIEMPRE, nombre o no un indice: la urgencia es UNA PALABRA ("recomendada",
  // "obligatoria") y lo que viene detras es el motivo clinico, que es del profesional. "OBLIGATORIA, sin
  // ejercicio los nutraceuticos son insuficientes" no es una urgencia, es una urgencia con su explicacion.
  const palabra = sinGuionLargo(urgencia).trim().split(CONDICION)[0]?.trim() ?? "";
  if (!palabra || nombraUnIndice(palabra)) return null;
  return palabra.toLowerCase();
}

/** Las tres partes de una ruta que el paciente puede ACCIONAR. La médica viaja como remisión. */
function indicacionesParaElPaciente(ruta: RutaContent): string[] {
  const componentes = [ruta.componentes.nutricional, ruta.componentes.ejercicio, ruta.componentes.psicologico];
  return componentes
    .filter((c) => c.aplica)
    .flatMap((c) => c.indicaciones)
    .map(paraElPaciente)
    .filter((l): l is string => l !== null);
}

/**
 * Reúne lo que el informe añade al plan. Recibe el snapshot ya leído (mismo trato que `getPlanPaciente`):
 * quien compone el documento ya lo tiene, y volver a pedirlo sería una segunda lectura del mismo dato.
 */
export async function getInformeDelPaciente(
  evaluationId: string,
  snapshot: unknown,
): Promise<InformeDelPaciente> {
  const rutasContent = ((snapshot as { rutasContent?: RutaContent[] } | null)?.rutasContent ?? []).filter(
    Boolean,
  );

  const protocolo = await getTreatmentProtocol(evaluationId);

  const [registradas, observacion, cita] = await Promise.all([
    protocolo ? listReferralsForTreatment(protocolo.treatmentId) : Promise.resolve([]),
    ultimaObservacionDeLaConsulta(evaluationId),
    getProximaCita(evaluationId),
  ]);

  return {
    rutas: rutasContent.map((r) => ({
      titulo: sinGuionLargo(r.label),
      indicaciones: indicacionesParaElPaciente(r),
      frecuencia: r.seguimiento?.frecuencia ? sinGuionLargo(r.seguimiento.frecuencia) : null,
    })),
    suplementos: {
      delModelo: protocolo?.recommendedNutraceuticals?.trim()
        ? sinGuionLargo(protocolo.recommendedNutraceuticals.trim())
        : null,
      delProfesional: (protocolo?.nutraceuticals ?? []).map((n) => ({
        nombre: n.name,
        dosis: n.dosage,
        duracionDias: n.durationDays,
      })),
    },
    remisiones: {
      // Del MISMO derivador que la historia clinica: si aqui se dedujeran otra vez, el documento del
      // paciente y el del profesional podrian nombrar remisiones distintas de la misma consulta.
      // LA URGENCIA TAMBIEN SE TRADUCE, y es por donde se colaron los indices en el informe que vio
      // Santiago: su campo de urgencia no es un enum, es texto suyo ("recomendada si IAE > 10 años").
      delModelo: remisionesExigidas(rutasContent, registradas).map((r) => ({
        destino: r.destino,
        urgencia: urgenciaParaElPaciente(r.urgencia ?? null),
      })),
      delProfesional: registradas.map((r) => ({
        destino: r.referredToOther?.trim() || r.referredTo,
        fecha: r.referredAt,
      })),
    },
    seguimiento: { observacion, proximaCita: cita },
  };
}

/**
 * La próxima cita VIGENTE del tratamiento. Consulta directa y no un lector compuesto por lo mismo que en
 * el plan: ningún lector existente la devuelve sola, y arrastrar el de la historia clínica entero por un
 * campo acoplaría el informe a ella.
 */
async function getProximaCita(evaluationId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("treatments")
    .select("proxima_cita, diagnoses!inner(evaluation_id)")
    .eq("diagnoses.evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`informe-paciente-reader (próxima cita): ${error.message}`);
  return (data?.proxima_cita as string | null) ?? null;
}
