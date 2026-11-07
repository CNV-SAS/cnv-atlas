import "server-only";

import type { RutaContent } from "@/clinical-engine/rutas-content";
import { remisionesExigidas } from "./hc-composicion";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listReferralsForTreatment } from "@/modules/referrals/data/referrals-reader";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

import { sinGuionLargo } from "@/lib/format/guion";

import { ultimoMensajeParaElPaciente } from "./freno-de-trayectoria";
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
  // MCCB: es el fenotipo estructural del modelo, y faltaba. Su linea de R6 ("Dieta de mantenimiento
  // personalizada segun fenotipo MCCB") llegaba al paciente nombrandolo.
  "MCCB",
  // BSQ: un cuestionario que el PROFESIONAL aplica. Para el paciente es una sigla sin referente.
  "BSQ",
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
  if (esDelProfesional(limpio)) return null;
  if (!nombraUnIndice(limpio)) return limpio;

  const accion = limpio.split(CONDICION)[0]?.trim() ?? "";
  if (!accion || nombraUnIndice(accion) || esDelProfesional(accion)) return null;
  return accion;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CUATRO CATEGORIAS QUE NO VAN AL PACIENTE  ·  SU HOJA 3 (Santiago, 2026-11-03)
//
// ═══ LO QUE REPORTO ═══
//
// Leyendo "Lo que vas a trabajar" de un informe real: *"Aquí sí veo contenido que se repite con HC y
// contenido muy técnico que no debería estar de cara al paciente."* Y su instruccion: *"por cada área,
// dos o tres frases sencillas de qué va a trabajar y cada cuánto es el control. Sin dosis (g/kg), sin
// contenido de alimentación (va en la hoja del plan), sin prescripción de ejercicio para el profesional
// (1RM, series), sin mecanismos («Nrf2», «metilación»). Lo técnico vive en la HC."*
//
// ═══ SE SUPRIME, NO SE REESCRIBE, Y ESO NO ES UN ATAJO ═══
//
// La cabecera de `rutas-content` lo tiene escrito desde el primer dia: *"ATLAS NO edita, resume ni
// reinterpreta este texto... si una indicacion clinica se lee mejor de otra forma, NO se toca aqui; se le
// pide a Gildardo."* Es la regla dura 12 aplicada a CONTENIDO. Asi que el mecanismo es el MISMO que ya
// usaba el filtro de indices: suprimir es representar menos, reescribir seria atribuirnos un cambio en su
// contenido clinico.
//
// LO QUE QUEDA ABIERTO SIGUE ABIERTO, y es lo mismo que este archivo ya anotaba: no existe una version de
// las rutas escrita para el paciente. Las "dos o tres frases sencillas" que Santiago describe no estan en
// su contenido, y escribirlas nosotros seria autoria clinica. Van al documento de dudas como propuesta.
//
// ═══ POR QUE POR CATEGORIAS Y NO LINEA POR LINEA ═══
//
// Clasificar a mano las ~100 indicaciones de las seis rutas serian ~100 juicios nuestros sobre su
// contenido, y cada uno invisible. Sus cuatro exclusiones son CATEGORIAS reconocibles por lo que la linea
// NOMBRA (una unidad de dosis, un alimento, un parametro de entrenamiento, una via molecular), asi que el
// filtro se escribe una vez y el candado imprime QUE SOBREVIVE en cada una de las seis rutas: las
// decisiones quedan a la vista en el test, no enterradas en cien banderas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * UNA DOSIS O UNA CIFRA DE PRESCRIPCION. El paciente recibe sus cifras en la hoja del plan, calculadas
 * para el; una dosis general en el informe es la del modelo, no la suya, y las dos juntas se contradicen.
 */
const DOSIS =
  /\bg\s*\/\s*kg|\bg\s*\/\s*d[ií]a|\bkcal\b|cal[óo]ric|\bmg\b|\bUI\b|\bml\s*\/\s*kg|\d\s*g\b|\d\s*%|≥\s*\d|\d\s*-\s*\d\s*g\b/i;

/**
 * CONTENIDO DE ALIMENTACION. Va en la hoja del plan, con su menu y su lista de intercambio: repetirlo
 * aqui con otras palabras es el mismo dato en dos documentos, y el que manda es el plan.
 */
const ALIMENTOS =
  /cúrcuma|curcuma|jengibre|té verde|te verde|bayas|berries|cacao|granada|crucíferas|cruciferas|avena|leguminosas|manzana|pescado|omega-3 dietario|harinas|azúcares|azucares|aceites refinados|grasas trans|ultraprocesados|fibra soluble|proteína preservada|proteina preservada|proteína alta|proteina alta|ayuno intermitente/i;

/**
 * PRESCRIPCION DE EJERCICIO PARA EL PROFESIONAL. No es "muevete": es la receta con la que un entrenador
 * programa. El paciente la recibe de quien lo entrena, que es a quien la remision lo manda.
 */
const EJERCICIO_TECNICO =
  /1RM|\bseries\b|repeticiones|multiarticular|sentadilla|peso muerto|\bpress\b|\bremo\b|resistencia progresiva|aerób|aerob/i;

/**
 * MECANISMOS. Explican POR QUE funciona, y eso es lo que §7.1 saca del documento del paciente: nombrar la
 * via molecular es nombrar el modelo con otras palabras.
 */
const MECANISMOS =
  /Nrf2|metilaci[óo]n|autofagia|epigenom|epigenétic|epigenetic|polifenol|sulforafano|anab[óo]lic|síntesis proteica|sintesis proteica|citocromo|disruptores endocrinos|leucina|cortisol|adiponectina|microambiente|membranas íntegras|homeostasis celular/i;

/**
 * UNA INSTRUCCION DIRIGIDA AL PROFESIONAL, no al paciente: "evaluar si...", "descartar...",
 * "correlacionar...", "laboratorios:...". El paciente no evalua ni descarta nada.
 */
const PARA_EL_PROFESIONAL =
  /^\s*(evaluar|evaluaci[óo]n|descartar|correlacionar|valorar|valoraci[óo]n|solicitar|laboratorios|documentar|coordinaci[óo]n obligatoria|electrocardiograma|perfil lip[íi]dico|seguimiento gluc[ée]mico|densitometr[íi]a|revisi[óo]n de polimedicaci[óo]n|remisi[óo]n a|remisi[óo]n m[ée]dica)\b/i;

/** ¿Esta linea es de las que su contenido escribe para el profesional y no para el paciente? */
export function esDelProfesional(texto: string): boolean {
  return (
    DOSIS.test(texto) ||
    ALIMENTOS.test(texto) ||
    EJERCICIO_TECNICO.test(texto) ||
    MECANISMOS.test(texto) ||
    PARA_EL_PROFESIONAL.test(texto)
  );
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
export function indicacionesParaElPaciente(ruta: RutaContent): string[] {
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
/**
 * LO QUE EL LLAMADOR YA TENGA, para no volver a pedirlo. La pantalla de la evaluación ya carga el
 * protocolo (el lector más pesado del proyecto: nueve consultas) y las remisiones registradas, así que
 * pedirlas otra vez era duplicar ese trabajo en CADA visita. Se vio en la terminal de Santiago: la página
 * tardaba 12 a 15 segundos en local. El envío del informe sí los deja vacíos y los lee él mismo.
 */
export type YaCargado = {
  protocolo?: Awaited<ReturnType<typeof getTreatmentProtocol>> | null;
  registradas?: { referredTo: string; referredToOther: string | null; referredAt: string }[];
};

export async function getInformeDelPaciente(
  evaluationId: string,
  snapshot: unknown,
  yaCargado: YaCargado = {},
): Promise<InformeDelPaciente> {
  const rutasContent = ((snapshot as { rutasContent?: RutaContent[] } | null)?.rutasContent ?? []).filter(
    Boolean,
  );

  const protocolo =
    yaCargado.protocolo !== undefined ? yaCargado.protocolo : await getTreatmentProtocol(evaluationId);

  const [registradas, observacion, cita] = await Promise.all([
    yaCargado.registradas !== undefined
      ? Promise.resolve(yaCargado.registradas)
      : protocolo
        ? listReferralsForTreatment(protocolo.treatmentId)
        : Promise.resolve([]),
    ultimoMensajeParaElPaciente(evaluationId),
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
      // ═══ LA POSOLOGIA SALE DEL CATALOGO (Santiago, 2026-09-28) ═══
      //
      // ANTES salia lo que el profesional tecleaba en dos campos, y el informe decia cosas como "LUVIA: 1
      // durante 1 dias", que es lo que alguien escribio para salir del campo. Esos campos se retiraron: SU
      // ARCHIVO NO LOS PIDE, tiene una tabla FIJA por producto y la imprime.
      //
      // `dosage` y `durationDays` SE SIGUEN LEYENDO como respaldo, y no es indecision: las prescripciones
      // ANTERIORES si los tienen, y un informe de una consulta vieja debe seguir diciendo lo que se le dijo al
      // paciente ese dia. Para las nuevas estan en null y manda el catalogo.
      delProfesional: (protocolo?.nutraceuticals ?? []).map((n) => {
        const c = protocolo?.catalog?.find((x) => x.id === n.nutraceuticalId);
        const delCatalogo = [c?.servingSize, c?.doseFrequency].filter(Boolean).join(" · ");
        return {
          nombre: n.name,
          dosis: n.dosage ?? (delCatalogo || null),
          // Los dias nunca estuvieron en su archivo, asi que solo salen si una prescripcion vieja los trae.
          duracionDias: n.durationDays,
        };
      }),
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
