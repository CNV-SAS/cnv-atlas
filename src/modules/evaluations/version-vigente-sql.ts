import { CODIGO_LINEA_BASE } from "./instrumento";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// "LA VERSION VIGENTE DE LA ENCUESTA", EN SQL  ·  MODULO NEUTRO  ·  2026-11-07
//
// Es la MISMA definicion que usa el lector (`data/version-vigente-de-la-encuesta`), escrita una sola vez
// para los sitios que no pasan por el cliente de Supabase: la escritura dentro de una transaccion y los
// catorce candados de BD que antes resolvian la version a mano.
//
// ═══ POR QUE NEUTRO Y NO DENTRO DEL READER ═══
//
// El reader es `server-only` y arrastra el cliente de servicio. Los candados solo quieren la cadena, y
// obligarlos a importar el reader los ataria a que haya variables de entorno de Supabase para leer una
// constante. Es el mismo motivo por el que existen los demas `*-types` del proyecto.
//
// ═══ LA DEFINICION, Y POR QUE NO ES "LA MAS RECIENTE" ═══
//
// Catorce candados y cuatro lectores hacian `order by published_at desc limit 1` SIN filtrar por
// plantilla, que no dice "la version mas reciente de la encuesta" sino "la fila mas reciente de la
// tabla". Funciono mientras hubo una sola plantilla. Al sembrar el Modulo S en la suya, esa consulta
// paso a devolver SIETE preguntas de adherencia y veintiocho casos se pusieron en rojo a la vez.
//
// La version vigente es LA QUE APLICA EL INSTRUMENTO DE LINEA BASE, y se toma de su primer item que no
// sea `propio` (`propio` = la pregunta es del instrumento, o sea del Modulo S).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export const SQL_VERSION_VIGENTE = `(
  select q.survey_version_id
    from survey_instrument_items i
    join survey_questions q on q.id = i.question_id
    join survey_instruments s on s.id = i.instrument_id
   where s.codigo = '${CODIGO_LINEA_BASE}' and i.comportamiento <> 'propio'
   order by i.order_index asc
   limit 1
)`;
