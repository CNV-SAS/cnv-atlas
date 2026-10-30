import type { HuellaRepetida } from "@/modules/bis/huella-repetida";
import type { MotivoDeRegularizacion } from "@/modules/consent/regularizacion";

import type { PendienteDelPaciente } from "./pendientes";

/**
 * Una evaluacion en el desplegable de la fila. Lleva su ROTULO ya resuelto ("Inicial", "Seguimiento 2")
 * porque la numeracion depende del ORDEN entre las del paciente, y eso se sabe donde estan todas juntas,
 * no en la vista fila por fila.
 */
export type EvaluacionDeLaFila = {
  evaluationId: string;
  /** "Inicial", "Seguimiento 1", "Seguimiento 2"... */
  rotulo: string;
  /** Fecha de medicion, o la de creacion si aun no se midio. */
  fecha: string;
};

import type { Database } from "@/types/database.generated";

// Tipos de dominio de pacientes (grupo 2), derivados de la Database generada.
type Tables = Database["public"]["Tables"];

export type Patient = Tables["patients"]["Row"];
export type PatientProfile = Tables["patient_profiles"]["Row"];
export type DocumentType = Database["public"]["Enums"]["document_type"];
export type EvaluationType = Database["public"]["Enums"]["evaluation_type"];

// Datos de identidad que llegan del intake (encuesta publica, sin sesion).
export type IdentityInput = {
  organizationId: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null; // yyyy-MM-dd
};

// Candidato a duplicado: un paciente distinto con alta similitud de nombre (y, si
// se conoce, misma fecha de nacimiento). El profesional resuelve aguas abajo; Atlas
// nunca fusiona automaticamente (MVP.md, resolucion de identidad).
export type DuplicateCandidate = {
  patientId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  documentType: DocumentType;
  documentNumber: string;
  score: number; // 0..1 similitud de nombre
  birthDateMatches: boolean;
};

// Resultado de la resolucion de identidad. mode es DERIVADO por documento exacto;
// Atlas no le pregunta al paciente inicial vs seguimiento. duplicateCandidates solo
// se llena en el caso inicial (sin match exacto pero con parecidos a revisar).
// identityConflict: el documento coincidio (seguimiento) PERO el nombre declarado difiere del registrado
// (nameSimilarity < umbral). Se atribuye igual (el documento es la llave) pero se marca para que el
// profesional resuelva antes de usarla. Solo puede ser true en modo 'seguimiento'.
export type IdentityResolution = {
  mode: EvaluationType; // 'inicial' (sin match) | 'seguimiento' (match exacto)
  matchedPatientId: string | null;
  duplicateCandidates: DuplicateCandidate[];
  identityConflict: boolean;
};

// Fila del roster de pacientes del profesional (/pacientes). El alcance (solo los
// pacientes propios, o todos para admin) lo resuelve RLS, no la app.
export type PatientListItem = {
  patientId: string;
  /**
   * Cuando se creo la FICHA del paciente (no su evaluacion). Es la columna "Fecha de creacion", que
   * reemplazo a "Ultima evaluacion" el 2026-09-10: esa repetia la primera de las tres fechas que ya salen
   * al desplegar la fila, y esta responde algo que la lista no decia en ningun sitio.
   */
  createdAt: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null; // yyyy-MM-dd
  status: string;
  evaluationCount: number;
  /** Fecha de la ultima evaluacion REAL (medicion; created_at si no se midio). null si no tiene. */
  lastEvaluationDate: string | null;
  /**
   * Le falta alguna autorizacion NECESARIA vigente (regla dura 15): no se le pueden crear evaluaciones.
   * Se calcula con la MISMA policy que gatea la creacion, para que la lista y el gate no discrepen.
   */
  sinAutorizacionVigente: boolean;
  /**
   * TIENE LAS TRES Y NO ALCANZAN (pieza 2 del consentimiento, dictamen legal del 2026-10-09).
   *
   * VA APARTE DE `sinAutorizacionVigente` porque la salida es OTRA: ahi el paciente retiro algo y hay que
   * pedirselo de nuevo; aqui nunca retiro nada y lo que falta es que firme quien podia firmar. Un solo
   * booleano para los dos casos mandaria al profesional a buscar una revocacion que no existe.
   *
   * Null = completo. Con valor, `frenaEvaluaciones` dice si ademas lo frena: no todos frenan (una fecha mal
   * digitada se corrige en dos clics y pararle la atencion al paciente por eso seria mas daño).
   */
  pendienteDeRegularizar: MotivoDeRegularizacion | null;
  /**
   * SU MEDICION ESTA EN OTRA CONSULTA VIGENTE (Gildardo, 2026-10-26).
   *
   * *"Hoy Angela solo se entera si alguien le dice. Atlas ya sabe cuales son por la huella."*
   *
   * NO ES UNA `AccionPendiente` Y ESO ES DELIBERADO: la columna de pendientes dice el ESCALON en el que
   * esta parada la consulta, y solo uno a la vez. Meter esto ahi taparia el trabajo real (o quedaria
   * tapado por el), y moveria el conteo del tablero, que cuenta esa misma regla. Va como CHIP, igual que
   * `pendienteDeRegularizar`: un aviso sobre la fila, no un paso de la secuencia.
   *
   * null = ninguna de sus consultas vigentes comparte su toma con otra.
   */
  medicionRepetida: HuellaRepetida | null;
  /**
   * DE PRUEBA, Y SE MUESTRA AQUI A PROPOSITO. La lista es una superficie de TRABAJO (capa 3 de
   * `de-prueba.ts`), asi que el paciente de prueba sigue en ella: si desapareciera, el profesional no
   * podria usarlo para probar, que es para lo que lo creo. Lo que no hace es contar en las cifras.
   *
   * `propuestoDePrueba` es distinto: el profesional lo propuso y admin no lo ha confirmado, asi que TODAVIA
   * cuenta en todo. Mezclarlos haria que la lista dijera "de prueba" y la cifra lo siguiera contando, que es
   * la clase de contradiccion que ya nos costo un diagnostico mal leido.
   */
  esDePrueba: boolean;
  propuestoDePrueba: boolean;
  /**
   * QUE LE FALTA, dicho como accion ("Montar BIS", "Generar diagnostico"), y cuantas evaluaciones mas
   * suyas estan paradas. Instruccion de Santiago (2026-09-10): la columna dice la ACCION, no el estado.
   * La regla vive en `pendientes.ts`, que es puro.
   */
  pendiente: PendienteDelPaciente;
  /**
   * LAS TRES ULTIMAS EVALUACIONES, para el desplegable de la fila (Santiago, 2026-09-10).
   *
   * VIENEN EN LA MISMA CONSULTA que ya se hacia: el lector de la lista ya embebia las evaluaciones para
   * contarlas y para la columna de pendientes; solo le faltaban el `id` y el `type`. Asi que desplegar
   * NO pide nada al servidor: el dato ya esta en la pagina cuando se pinta la lista.
   *
   * TRES Y NO TODAS porque el desplegable es un atajo, no la ficha: quien quiera la historia entera tiene
   * el boton del panel en la columna de acciones, que es donde vive ahora.
   */
  ultimasEvaluaciones: EvaluacionDeLaFila[];
};

// Una evaluacion en la linea de tiempo del paciente (/pacientes/[id]). Enlaza a la
// vista de resultados que ya existe (/ani-bis-e/[id]).
export type PatientEvaluationItem = {
  evaluationId: string;
  type: EvaluationType;
  status: string;
  createdAt: string;
  measurementDate: string | null; // fecha de MEDICION (cronologia clinica); null si aun no se midio
  superseded: boolean; // reemplazada por una correccion: se marca, no se oculta (la historia la conserva)
  reasonForVisit: string[]; // motivo de consulta (caracterizacion del encuentro, multi); [] si no se dio
  /**
   * LA CONSULTA NO OCURRIO (0212): el paciente agendo y no vino. Se pliega en la historia y no cuenta como
   * trabajo pendiente, pero NO se borra: su encuesta y su consentimiento son actos reales.
   */
  noOcurrio: boolean;
  /** Con que motivo se retiro, para poder leerlo sin ir al audit. */
  motivoDelRetiro: string | null;
  /**
   * HAY UN BORRADOR DE ENCUESTA del paciente, aunque no la haya enviado (2026-10-22).
   *
   * EL CASO QUE LO PIDE: una paciente respondio 22 preguntas, el envio final se cayo por red, y la
   * evaluacion quedo en `awaiting_survey` con esas respuestas dentro. La ficha decia "Esperando la
   * encuesta" y la pantalla del modelo la mostraba llena: las dos tenian razon, pero juntas se leen como
   * un sistema roto (hazard 4 de CLAUDE.md). Decirlo aqui une las dos lecturas en una sola frase.
   */
  tieneBorradorDeEncuesta: boolean;
};

// Detalle del paciente para su historia (/pacientes/[id]): identidad, contacto y la
// linea de tiempo de sus evaluaciones. RLS decide si la sesion puede verlo (null si no).
export type PatientDetail = {
  patientId: string;
  documentType: DocumentType;
  documentNumber: string;
  status: string;
  /** De prueba (confirmado por admin): fuera de las cifras y de la facturacion, visible aqui. */
  esDePrueba: boolean;
  /** Propuesto por el profesional y sin confirmar: TODAVIA cuenta en todo. Ver `de-prueba.ts`. */
  propuestoDePrueba: boolean;
  motivoDePrueba: string | null;
  /**
   * Hay una peticion de ELIMINAR el perfil esperando a la direccion (0233). El paciente sigue entero y
   * se le puede atender: lo unico que cambia es que no se puede pedir dos veces.
   */
  eliminacionPedida: boolean;
  motivoDeEliminacion: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  sex: string | null;
  city: string | null;
  country: string | null;
  // Caracterizacion sociodemografica OPCIONAL (E1). null si el paciente no la dio.
  educationLevel: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  socioeconomicStratum: string | null;
  ethnicity: string | null;
  ancestry: string | null;
  email: string | null;
  phone: string | null;
  evaluations: PatientEvaluationItem[];
};

// Estado de la busqueda por documento antes de crear un paciente en consulta (useActionState). Modulo
// NEUTRO a proposito: lo produce una action de servidor y lo consume la pantalla del profesional, que es
// cliente. El tipo VeredictoDocumento vive en el reader `server-only` y NO puede cruzar esta frontera.
//
// LO QUE VIAJA, y es todo lo que puede viajar: el veredicto. En 'ajeno' no hay ni un dato mas, ni el
// nombre ni de quien es (el candado `buscar-por-documento.test.ts` lo sostiene). En 'propio' viaja el id
// del paciente y el de su evaluacion pendiente, que la RLS ya le dejaba leer.
export type VerificarDocumentoState = {
  error: string | null;
  veredicto: "libre" | "propio" | "ajeno" | null;
  /** Eco de lo consultado, para que la pantalla siga adelante con el mismo documento sin re-teclearlo. */
  documentType: string | null;
  documentNumber: string | null;
  patientId: string | null;
  evaluacionPendienteId: string | null;
};

/** Estado de la accion de archivar. Misma forma que el resto de formularios (`FormToastState`). */
export type ArchivarPacienteState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

/** Estado de la accion de corregir el contacto. Misma forma que el resto (`FormToastState`). */
export type ContactoPacienteState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

/** Estado de la accion de completar el sexo que falta. Misma forma (`FormToastState`). */
export type SexoPacienteState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};
