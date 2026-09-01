import type { EngineOutput } from "./types";

// EL DFI EN LENGUAJE DE PACIENTE. PORTE del mapa de Gildardo (`_dfiPac`, v8 · `enviarInformePaciente`).
//
// NO ES UNA SIMPLIFICACION NUESTRA, y la distincion es toda: es una decision clinica suya, escrita en su
// archivo, sobre como se le habla a una persona de su propio estado. Su comentario al lado del bloque:
// "version amable y segura... sin CRITICO alarmante, sin mencionar TCA".
//
// POR QUE SE PORTA Y NO SE ESCRIBE: escribir nosotros el lenguaje con el que se le dice a alguien que su
// riesgo es alto seria inventar contenido clinico, que es exactamente lo que la Regla 0 prohibe. Estaba
// resuelto en su archivo, asi que se copia.
//
// SU REGLA PARA LO QUE EL MAPA NO CUBRE, tambien portada: `_NIVPAC[nivel] || nivel`, es decir, lo que no
// traduce se deja como esta. No se rellena con nada.

/** Los cuatro niveles de riesgo, en su lenguaje. `_NIVPAC` verbatim. */
const NIVEL_PACIENTE: Record<string, string> = {
  BAJO: "Óptimo",
  MEDIO: "A mejorar",
  ALTO: "Requiere atención",
  "CRÍTICO": "Prioritario",
};

/** La frase de enfoque por nivel. `_ENFOQUE` verbatim, incluida su puntuacion. */
const ENFOQUE_PACIENTE: Record<string, string> = {
  BAJO: "Mantén tus buenos hábitos y sigue optimizando tu bienestar.",
  MEDIO: "Con algunos ajustes guiados por tu profesional mejorarás notablemente.",
  ALTO: "Es importante trabajar de forma activa con tu profesional en los próximos meses.",
  "CRÍTICO": "Tu profesional te dará un seguimiento cercano; conviene empezar pronto.",
};

/** Las severidades por dominio, en su lenguaje. `_SEVPAC` verbatim: indices 0 a 3. */
const SEVERIDAD_PACIENTE = ["En equilibrio", "A vigilar", "A trabajar", "Prioritario"] as const;

/**
 * La frase que REEMPLAZA la lectura del dominio conductual cuando su severidad es alta. Verbatim.
 *
 * Es la pieza mas delicada del mapa y la razon por la que no se podia escribir de memoria: la lectura
 * tecnica de ese dominio puede nombrar conductas de riesgo alimentario, y el decidio que al paciente no se
 * le dice eso, se le dice que lo van a acompañar.
 */
const ACOMPANAMIENTO_CONDUCTUAL =
  "Te acompañaremos de cerca en tu relación con la alimentación y la imagen corporal; tu bienestar emocional es la prioridad.";

/** La frase del veto, tambien verbatim. Su veto se reformula como acompañamiento, no como advertencia. */
const ACOMPANAMIENTO_VETO =
  "Tu profesional te acompañará de cerca; priorizaremos tu bienestar emocional antes que cualquier cambio en la alimentación.";

export type DominioPaciente = {
  id: string;
  dominio: string;
  /** Su etiqueta de severidad, o null si el dominio NO SE MIDIO (ver la nota de abajo). */
  nivel: string | null;
  lectura: string;
};

export type DfiPaciente = {
  riesgo: string;
  enfoque: string;
  dominios: DominioPaciente[];
  acompanamiento: string | null;
};

/**
 * Traduce el DFI del snapshot al lenguaje del paciente.
 *
 * DOS COSAS QUEDAN FUERA DE SU MAPA, y las dos son deliberadas y estan declaradas en la ronda:
 *
 * 1 · UN DOMINIO SIN DATO NO RECIBE ETIQUETA. Su `_SEVPAC[sev]` espera un indice de 0 a 3, y desde su
 *     punto 4 del 2026-08-30 un dominio sin dato NO PUNTUA: su severidad es `null`. Su mapa es anterior a
 *     esa decision suya, asi que no lo cubre. Se devuelve `nivel: null` y la lectura que el motor ya
 *     produce ("no se evaluo..."). Inventarle una quinta etiqueta seria agregarle un nivel a su escala.
 *
 * 2 · EL INDICE NUMERICO NO SALE. Su `informePaciente` incluye `indice: dfi.riesgo.score`, pero su §7.1
 *     dice que ningun indice del modelo va al paciente. Entre su instruccion y su implementacion mandan
 *     sus palabras: va el NIVEL ("Requiere atención"), que es lo que una persona puede leer, no el numero.
 *
 * Y tampoco viajan `lvl` ni `color`: son de la presentacion de su app, no del contenido.
 */
export function dfiParaPaciente(snapshot: EngineOutput): DfiPaciente | null {
  const dfi = snapshot.dfi;
  if (!dfi) return null;

  const nivelRiesgo = dfi.riesgo.nivel;
  return {
    // Su fallback, portado: lo que el mapa no traduce se deja como esta.
    riesgo: NIVEL_PACIENTE[nivelRiesgo] ?? nivelRiesgo,
    enfoque: ENFOQUE_PACIENTE[nivelRiesgo] ?? dfi.riesgo.descripcion,
    dominios: dfi.domains.map((d) => ({
      id: d.id,
      dominio: d.nombre,
      nivel: d.sev == null ? null : (SEVERIDAD_PACIENTE[d.sev] ?? null),
      // Su regla del dominio conductual (`d4`) con severidad alta. El `d.sev != null` es nuestro y es
      // necesario: con severidad nula la comparacion `>= 2` seria falsa por casualidad, no por criterio.
      lectura: d.id === "d4" && d.sev != null && d.sev >= 2 ? ACOMPANAMIENTO_CONDUCTUAL : d.lectura,
    })),
    acompanamiento: dfi.veto ? ACOMPANAMIENTO_VETO : null,
  };
}
