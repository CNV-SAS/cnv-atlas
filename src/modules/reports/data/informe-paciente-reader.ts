import "server-only";

import type { RutaContent } from "@/clinical-engine/rutas-content";
import { remisionesExigidas } from "./hc-composicion";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listReferralsForTreatment } from "@/modules/referrals/data/referrals-reader";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

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

/** Los indices del modelo. Una linea que nombre cualquiera de estos no viaja al paciente. */
const LENGUAJE_DEL_MODELO = [
  "IFC",
  "IRC",
  "PABU",
  "ICA-BIS",
  "ISCM",
  "IEHH",
  "FFMI",
  "FMI",
  "EB-BIS",
  "IAE",
  "DFI",
  "BIS",
  "HOMA-IR",
  "PCR",
];

/**
 * ¿Esta linea es para el paciente? Se compara sobre PALABRAS COMPLETAS (`\b`) a proposito: "BIS" dentro
 * de "ANI-BIS-E" o de una palabra corriente no deberia descartar una indicacion util, y al reves, una
 * sigla suelta descarta la linea entera aunque el resto se entienda.
 */
export function esParaElPaciente(linea: string): boolean {
  return !LENGUAJE_DEL_MODELO.some((sigla) =>
    new RegExp(`(^|[^A-Za-zÁÉÍÓÚÑ0-9-])${sigla}([^A-Za-zÁÉÍÓÚÑ0-9-]|$)`).test(linea),
  );
}

/** Las tres partes de una ruta que el paciente puede ACCIONAR. La médica viaja como remisión. */
function indicacionesParaElPaciente(ruta: RutaContent): string[] {
  const componentes = [ruta.componentes.nutricional, ruta.componentes.ejercicio, ruta.componentes.psicologico];
  return componentes
    .filter((c) => c.aplica)
    .flatMap((c) => c.indicaciones)
    .filter(esParaElPaciente);
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
      titulo: r.label,
      indicaciones: indicacionesParaElPaciente(r),
      frecuencia: r.seguimiento?.frecuencia ?? null,
    })),
    suplementos: {
      delModelo: protocolo?.recommendedNutraceuticals?.trim() || null,
      delProfesional: (protocolo?.nutraceuticals ?? []).map((n) => ({
        nombre: n.name,
        dosis: n.dosage,
        duracionDias: n.durationDays,
      })),
    },
    remisiones: {
      // Del MISMO derivador que la historia clinica: si aqui se dedujeran otra vez, el documento del
      // paciente y el del profesional podrian nombrar remisiones distintas de la misma consulta.
      delModelo: remisionesExigidas(rutasContent, registradas).map((r) => ({
        destino: r.destino,
        urgencia: r.urgencia ?? null,
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
