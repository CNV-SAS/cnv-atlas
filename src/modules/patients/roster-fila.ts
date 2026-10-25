// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA FILA DEL ROSTER, ARMADA EN TypeScript A PARTIR DE HECHOS  ·  (Santiago/Gildardo, 2026-10-24)
//
// ═══ POR QUE ESTE MODULO EXISTE ═══
//
// La consulta de /pacientes traia ~4.598 filas embebidas para pintar 553, y cada fila embebida paga su
// policy (la 0222 lo midio: 489 ms sin RLS contra timeout con ella). La salida elegida fue mover la
// AGREGACION a SQL y dejar la REGLA en TypeScript:
//
//   · SQL responde HECHOS: ¿tiene medicion? ¿tiene diagnostico? ¿en que estado esta su reporte? Son
//     `exists` y subconsultas, no criterios clinicos.
//   · TypeScript sigue DECIDIENDO: que le falta al paciente (`pendienteDelPaciente`), si se le puede
//     crear una evaluacion (`canCreateEvaluation`), si hay algo que regularizar
//     (`motivoDeRegularizacion`) y como se numeran sus seguimientos.
//
// La alternativa era calcular esas tres cosas en SQL, y entonces habria DOS definiciones de cada regla
// clinica capaces de divergir. Es el hazard 4 de CLAUDE.md a escala de base de datos: dos superficies
// leyendo fuentes distintas de lo mismo.
//
// ═══ Y POR QUE ES UN MODULO APARTE Y NO EL CUERPO DEL LECTOR ═══
//
// Porque es lo que vuelve DEMOSTRABLE que el cambio no movio ninguna cifra. La prueba
// `el-roster-por-la-vista-no-cambia-ninguna-cifra-db` arma esta misma fila por los DOS caminos (la
// consulta de embeds de antes y la vista nueva) y compara los resultados campo por campo. Si el mapeo
// viviera dentro del lector, habria que escribirlo dos veces para compararlo, y entonces la comparacion
// no probaria nada.
//
// MODULO NEUTRO: sin `server-only`, sin React, sin BD. Puro.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import type { ConsentType } from "@/modules/consent/validations";
import { hechosDelConsentimiento, motivoDeRegularizacion } from "@/modules/consent/regularizacion";
import { canCreateEvaluation } from "@/modules/evaluations/policies/can-create-evaluation";

import { NON_COUNTING_EVALUATION_STATUSES } from "./labels";
import { pendienteDelPaciente } from "./pendientes";
import type { DocumentType, PatientListItem } from "./types";

/**
 * UNA EVALUACION EN PIE, con sus hechos YA RESUELTOS.
 *
 * "En pie" = ni reemplazada por una correccion (`superseded_at`) ni retirada porque la consulta no
 * ocurrio (`retirada_at`, 0212). El filtro lo hace la vista, porque es un hecho y no una regla.
 */
export type EvaluacionDelRoster = {
  evaluationId: string;
  type: string;
  status: string;
  /** Del registro de la evaluacion, no de la medicion. */
  createdAt: string;
  /** Fecha de la medicion BIS, o null si no se midio. */
  fechaDeMedicion: string | null;
  tieneBis: boolean;
  tieneCondicionesBis: boolean;
  tieneDiagnostico: boolean;
  /** Estado del reporte, o null si todavia no hay. */
  reporte: string | null;
  /** Vino de un lote del HTML. */
  importada: boolean;
};

/** Los hechos de un paciente, tal como los devuelve la vista (y tal como se reconstruyen de los embeds). */
export type FilaCrudaDelRoster = {
  patientId: string;
  createdAt: string;
  documentType: DocumentType;
  documentNumber: string;
  status: string;
  cuentaComoDePrueba: boolean;
  testProposedAt: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  /** Autorizaciones VIGENTES (ya filtradas por `revoked_at is null`), con su firma. */
  consentimientosVigentes: readonly { consent_type: string; signed_at: string | null }[];
  evaluaciones: readonly EvaluacionDelRoster[];
};

/**
 * La fila que pinta la pantalla. TODAS las decisiones de aqui para abajo son de TypeScript.
 */
export function filaDelRoster(cruda: FilaCrudaDelRoster): PatientListItem {
  // LAS QUE CUENTAN: en pie Y que sean una consulta hecha. La misma condicion sirve para el conteo y
  // para la ultima fecha; separarlas dejaria "3 consultas · Ultima: <de una que no cuenta>".
  const reales = cruda.evaluaciones.filter((e) => !NON_COUNTING_EVALUATION_STATUSES.has(e.status));

  // FECHA DE MEDICION, no la de creacion del registro: es la cronologia clinica, la misma que usa la
  // ficha del paciente. Si no se midio, cae a `createdAt` para no perder la fila del listado.
  const fechas = reales
    .map((e) => e.fechaDeMedicion ?? e.createdAt)
    .filter(Boolean)
    .sort();

  // EL GATE DE LA REGLA DURA 15 SE LE PREGUNTA A LA POLICY, no a una copia del criterio: la lista y el
  // boton de crear evaluacion no pueden discrepar.
  const vigentes = cruda.consentimientosVigentes.map((c) => c.consent_type as ConsentType);
  const regularizar = motivoDeRegularizacion(
    hechosDelConsentimiento({
      fechaDeNacimiento: cruda.birthDate,
      consents: cruda.consentimientosVigentes,
      // SIN LAS SESIONES PRESENCIALES, y es una ausencia deliberada: el motivo que sale de ellas (una
      // fecha corregida que cambia la rama) NO frena evaluaciones, asi que no cambia esta columna. Ese
      // motivo se ve en la ficha, que es donde se puede actuar sobre el.
    }),
  );

  return {
    patientId: cruda.patientId,
    createdAt: cruda.createdAt,
    documentType: cruda.documentType,
    documentNumber: cruda.documentNumber,
    firstName: cruda.firstName,
    lastName: cruda.lastName,
    birthDate: cruda.birthDate,
    status: cruda.status,
    evaluationCount: reales.length,
    lastEvaluationDate: fechas.length ? fechas[fechas.length - 1] : null,
    // SOLO LAS QUE FALTAN, y por eso pasa `null` aqui: este rotulo dice "Sin autorizacion vigente", y un
    // menor sin representante NO retiro ninguna. Meter los dos casos en el mismo booleano hacia que la
    // lista afirmara una revocacion que no existe.
    sinAutorizacionVigente: !canCreateEvaluation(vigentes, null).ok,
    pendienteDeRegularizar: regularizar,
    // LAS TRES ULTIMAS, con su rotulo. La NUMERACION del seguimiento sale del orden entre las
    // evaluaciones REALES del paciente (el primer seguimiento es el 1, no el numero de fila), asi que se
    // calcula aqui, que es donde estan todas juntas. La vista solo pinta.
    ultimasEvaluaciones: (() => {
      const enOrden = [...reales].sort((a, b) =>
        (a.fechaDeMedicion ?? a.createdAt).localeCompare(b.fechaDeMedicion ?? b.createdAt),
      );
      let n = 0;
      const conRotulo = enOrden.map((e) => ({
        evaluationId: e.evaluationId,
        rotulo: e.type === "inicial" ? "Inicial" : `Seguimiento ${++n}`,
        fecha: e.fechaDeMedicion ?? e.createdAt,
      }));
      // LAS ULTIMAS TRES, de la mas reciente a la mas antigua: es el orden en que se buscan.
      return conRotulo.slice(-3).reverse();
    })(),
    // QUE LE FALTA, dicho como accion. Se mira sobre TODAS las que estan en pie, no sobre `reales`: una
    // que espera la encuesta no cuenta como consulta hecha pero SI es algo pendiente, que es justo lo
    // que esta columna busca.
    pendiente: pendienteDelPaciente(
      cruda.evaluaciones.map((e) => ({
        evaluationId: e.evaluationId,
        status: e.status,
        tieneBis: e.tieneBis,
        importada: e.importada,
        tieneCondicionesBis: e.tieneCondicionesBis,
        tieneDiagnostico: e.tieneDiagnostico,
        reporte: e.reporte,
      })),
      !canCreateEvaluation(vigentes, regularizar).ok,
    ),
    // LA LISTA SI LOS MUESTRA (capa de TRABAJO), marcados. El conteo del tablero no los cuenta. Y la
    // DERIVADA (0202) tambien se rotula: mostrar la marca solo cuando alguien la escribio a mano dejaria
    // al profesional viendo un paciente sin rotulo que las cifras ya no cuentan.
    esDePrueba: cruda.cuentaComoDePrueba,
    propuestoDePrueba: !cruda.cuentaComoDePrueba && cruda.testProposedAt != null,
  } satisfies PatientListItem;
}

/**
 * EL ORDEN BASE con el que la lista llega a la pantalla.
 *
 * POR EL NOMBRE COMO SE MUESTRA ("nombre apellido") y no por apellido (2026-09-09): ordenaba por algo que
 * no esta a la vista, asi que la lista se veia desordenada. La vista tiene ademas su propio conmutador
 * (A-Z / evaluacion reciente), y las dos capas tienen que decir lo mismo: dos ordenes distintos es como
 * se consigue que la lista salte al hidratar.
 */
export function ordenarElRoster(items: PatientListItem[]): PatientListItem[] {
  return items.sort((a, b) =>
    `${a.firstName} ${a.lastName}`.trim().localeCompare(`${b.firstName} ${b.lastName}`.trim(), "es"),
  );
}
