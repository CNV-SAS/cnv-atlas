import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { type HuellaRepetida } from "../huella-repetida";
import { huellaDeLaMedicion, VARIABLES_DE_LA_HUELLA } from "../services/huella-de-la-medicion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE CONSULTAS VIGENTES COMPARTEN LA MISMA TOMA FISICA  ·  EL AVISO, NO EL FRENO
//
// ═══ DE DONDE SALE (Gildardo, 2026-10-26) ═══
//
// *"Hoy Angela solo se entera si alguien le dice. Atlas ya sabe cuales son por la huella. Construye un
// aviso en cada una de esas consultas y en su lista de pendientes: 'Esta medicion esta repetida en otra
// consulta: revisa a quien pertenece'. Sin decir quien es el otro paciente si no tiene acceso a esa
// historia, como ya hace el freno. El aviso desaparece solo cuando la huella deja de repetirse."*
//
// ═══ POR QUE NO ES EL FRENO, AUNQUE USE LA MISMA HUELLA ═══
//
// `medicion-duplicada-reader` contesta *"¿puede entrar este archivo NUEVO?"* dentro de la transaccion del
// import, y para eso necesita los crudos que vienen en el XLSX. Esto contesta *"¿la medicion que YA esta
// aqui esta repetida?"*, sobre lo guardado y fuera de toda transaccion. Son dos preguntas distintas en dos
// momentos distintos; lo que comparten, y es lo que no se puede duplicar, es la FUNCION DE LA HUELLA.
//
// ═══ EL AVISO SE APAGA SOLO, Y ESO NO ES UNA FUNCION: ES LA CONSECUENCIA DE DERIVARLO ═══
//
// No hay marca, ni columna, ni fecha de "revisado". Se calcula cada vez sobre las consultas VIGENTES, asi
// que en cuanto la correccion deje una sola de las dos en pie, el aviso desaparece por su cuenta. Una
// marca de "ya lo revise" habria que acordarse de quitarla, y entonces el aviso sobreviviria al arreglo o
// moriria antes.
//
// ═══ SOLO ENTRE VIGENTES, QUE ES LO QUE HACE INNECESARIAS LAS EXCEPCIONES DEL FRENO ═══
//
// El freno exceptua la copia de una cadena de correccion y la medicion marcada como de otro paciente.
// Aqui no hacen falta: al corregir, la version vieja queda `superseded_at`, y la medicion marcada se queda
// colgada de ella. Las dos salen del universo antes de comparar. Mismo criterio que la exclusion de
// investigacion de la 0230.
//
// ═══ LEE CON LA CONEXION DE SISTEMA, Y ESO ES DELIBERADO ═══
//
// La huella gemela puede estar en la historia clinica de OTRO profesional, que es justo el caso que hay
// que avisar (4 de los grupos medidos estan entre pacientes distintos). Bajo RLS, el profesional de Angela
// no veria esa fila y el aviso nunca aparaceria: el defecto se esconderia precisamente en el caso grave.
//
// LO QUE SALE DE AQUI NO IDENTIFICA A NADIE: cuantas otras consultas comparten la toma, y si alguna es del
// MISMO paciente. Ni un id de paciente ajeno, ni un nombre, ni una fecha de otra historia. Es la misma
// linea que ya traza el freno: *"lo que necesita saber es que ESE archivo es de otra persona, y eso si se
// dice"*.
// ══════════════════════════════════════════════════════════════════════════════════════════════════


/**
 * Las consultas vigentes cuya medicion esta repetida, por `evaluationId`.
 *
 * Vacio = ninguna. UNA sola ida a la base, y el conjunto se calcula completo: el aviso hay que poder
 * pintarlo en una lista de 553 pacientes sin una consulta por fila.
 */
export async function huellasRepetidasEnVigentes(): Promise<Map<string, HuellaRepetida>> {
  // LAS CUATRO LECTURAS DE LAS MEDICIONES DE CONSULTAS VIGENTES DE PACIENTES REALES.
  //
  // El filtro de vigencia es el MISMO de `evaluaciones_vigentes` (0224/0230), escrito aqui porque esa
  // vista esta revocada a `authenticated` a proposito y este lector no es un producto de datos.
  const filas = await db.execute<{
    evaluation_id: string;
    patient_id: string;
    measurement_id: string;
    variable_name: string;
    value: string;
  }>(sql`
    select e.id as evaluation_id, e.patient_id, m.id as measurement_id,
           r.variable_name, r.value::text as value
      from evaluations e
      join patients p on p.id = e.patient_id
      join bis_measurements m on m.evaluation_id = e.id
      join bis_raw_values r on r.measurement_id = m.id
     where p.deleted_at is null
       and coalesce(p.cuenta_como_de_prueba, false) = false
       and e.superseded_at is null
       and e.retirada_at is null
       -- LOS CUATRO NOMBRES VAN COMO PARAMETROS, no interpolados en el texto: aunque salgan
       -- de una constante, una consulta que se construye pegando cadenas es la forma que no se revisa la
       -- segunda vez. Y asi los cuatro nombres siguen saliendo de VARIABLES_DE_LA_HUELLA.
       -- Drizzle expande el arreglo a ($1, $2, $3, $4), que es lo que IN espera; con ANY falla porque
       -- ese operador quiere UN arreglo a la derecha, no una tupla.
       and r.variable_name in ${VARIABLES_DE_LA_HUELLA}`);

  // LA HUELLA SE ARMA CON LA MISMA FUNCION QUE EL FRENO, no con un `string_agg` en SQL: dos formatos de la
  // misma huella divergen por un cero de mas (2.04 contra 2.040), y entonces el freno y el aviso dejarian
  // de hablar del mismo hecho.
  const porMedicion = new Map<
    string,
    { evaluationId: string; patientId: string; valores: { variableName: string; value: string }[] }
  >();
  for (const f of filas) {
    const ya = porMedicion.get(f.measurement_id);
    if (ya) ya.valores.push({ variableName: f.variable_name, value: f.value });
    else {
      porMedicion.set(f.measurement_id, {
        evaluationId: f.evaluation_id,
        patientId: f.patient_id,
        valores: [{ variableName: f.variable_name, value: f.value }],
      });
    }
  }

  const porHuella = new Map<string, { evaluationId: string; patientId: string }[]>();
  for (const m of porMedicion.values()) {
    const huella = huellaDeLaMedicion(m.valores);
    // NULL = NO SE PUEDE COMPARAR, y entonces no se avisa. Avisar por no poder comparar seria avisar de lo
    // que no se sabe, igual que el freno no frena.
    if (huella === null) continue;
    const ya = porHuella.get(huella) ?? [];
    ya.push({ evaluationId: m.evaluationId, patientId: m.patientId });
    porHuella.set(huella, ya);
  }

  const repetidas = new Map<string, HuellaRepetida>();
  for (const grupo of porHuella.values()) {
    // DOS EVALUACIONES DISTINTAS, no dos mediciones de la misma consulta: una consulta con dos tomas
    // identicas es otra cosa (y hoy no pasa), y contarla aqui inflaria el aviso.
    const evaluaciones = [...new Set(grupo.map((g) => g.evaluationId))];
    if (evaluaciones.length < 2) continue;
    for (const evaluationId of evaluaciones) {
      const mio = grupo.find((g) => g.evaluationId === evaluationId)!;
      const otras = grupo.filter((g) => g.evaluationId !== evaluationId);
      repetidas.set(evaluationId, {
        otras: new Set(otras.map((o) => o.evaluationId)).size,
        mismoPaciente: otras.some((o) => o.patientId === mio.patientId),
        otroPaciente: otras.some((o) => o.patientId !== mio.patientId),
      });
    }
  }
  return repetidas;
}

/** Lo mismo para UNA consulta. Devuelve `null` si su medicion no esta repetida (o si no tiene). */
export async function huellaRepetidaDeLaConsulta(evaluationId: string): Promise<HuellaRepetida | null> {
  // SE REUSA EL CONJUNTO COMPLETO A PROPOSITO, en vez de una consulta acotada a esta evaluacion: para
  // saber si SU huella esta repetida hay que mirar a todas las demas igual, asi que acotar no ahorraria la
  // parte cara y si abriria una segunda definicion de "repetida".
  const todas = await huellasRepetidasEnVigentes();
  return todas.get(evaluationId) ?? null;
}
