import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { mayorDelMotor } from "@/modules/followups/services/eb-trajectory";
import { ciudadesUnificadas } from "../services/ciudades-de-la-cohorte";
import {
  FILTRO_VACIO,
  type FiltroDeCohorte,
  formaDeLaCiudadElegida,
} from "../services/filtro-de-la-cohorte";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA COHORTE DE INVESTIGACION, EN CIFRAS  ·  LA PANTALLA DE LA VISTA evaluaciones_para_investigacion
//
// ═══ POR QUE EXISTE (Santiago, 2026-10-24) ═══
//
// *"Gildardo queda con profesional y obbia a la vez... verifica que con los dos no se le rompe nada: que
// ve lo suyo como profesional y lo de investigacion por la vista evaluaciones_para_investigacion."*
//
// La vista se creo en la 0224 y NO TENIA NINGUNA PANTALLA. Un mecanismo sin superficie que lo alcance hace
// creer que una regla ya se aplica: el panel de investigacion seguia listando solo `research_datasets`, que
// tiene cero filas, asi que quien entrara con el rol obbia veria "no hay nada" y concluiria que no hay
// datos, cuando lo que no habia era la consulta.
//
// ═══ POR QUE SE LEE COMO DUEÑO (Drizzle) Y NO POR RLS ═══
//
// La 0224 revoca las dos vistas a `anon` y `authenticated` A PROPOSITO: son un producto de datos, no una
// superficie de RLS, y abrirlas a `authenticated` las volveria una puerta alrededor de las policies de
// `evaluations`. Asi que la unica forma de leerlas es como dueño, y la autorizacion la pone la policy en la
// pagina (`canViewObbia`, regla dura 3), igual que los otros catorce lectores que leen con `db`.
//
// ═══ Y AQUI NO SALE NI UNA FILA, SOLO CIFRAS ═══
//
// La promesa del panel es literal: *"Solo data agregada o anonimizada; nunca datos personales del
// paciente."* La vista ya no trae ninguna columna que identifique a nadie, y esto ademas agrega: cuenta y
// agrupa. Ni un `patient_id` cruza esta frontera.
//
// ═══ LO QUE QUEDA FUERA SE DICE, NO SOLO LO QUE QUEDA DENTRO ═══
//
// Es lo que pide el comentario de la propia vista: la autorizacion de investigacion es OPCIONAL, y un
// dataset que solo dice cuantos trae deja creer que son todos. Por eso la cifra de excluidos es una
// columna del informe, no un calculo que alguien tenga que hacer aparte.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type CohorteDeInvestigacion = {
  /** Consultas hechas, vigentes, de pacientes reales. El universo clinico. */
  vigentes: number;
  /** De ellas, las que el paciente autorizo para investigacion. */
  conAutorizacion: number;
  /**
   * Las que quedan fuera POR NO TENER LA AUTORIZACION. Se cuenta directo, no por resta.
   *
   * Y ESO CAMBIO CON LA 0230: antes era `vigentes - conAutorizacion`, y al empezar a excluir tambien por
   * calidad de dato esa resta habria metido las de huella repetida en el cubo del consentimiento. El
   * rotulo dice "sin autorizacion", asi que contarlas ahi seria afirmar que 13 pacientes no autorizaron
   * cuando si lo hicieron. Una cifra por resta hereda todo lo que se le quite al total.
   */
  sinAutorizacion: number;
  /**
   * LAS QUE SALEN POR CALIDAD DE DATO (0230): autorizadas, pero con la misma toma fisica en otra consulta
   * vigente. Se dice aparte porque no es lo mismo que no tener permiso, y porque vuelven solas en cuanto
   * se corrija cual de las dos es.
   */
  fueraPorHuellaRepetida: { consultas: number; grupos: number; pacientes: number };
  /** Pacientes distintos en la cohorte autorizada. */
  pacientesAutorizados: number;
  /** De la cohorte autorizada, cuantas tienen diagnostico sellado (las unicas con indicadores). */
  conDiagnostico: number;
  /** Importadas del HTML Y autorizadas: las que de verdad entran a un dataset. */
  importadas: number;
  /**
   * TODAS las importadas vigentes, autorizadas o no.
   *
   * SIN ESTA, EL 8 ERA UNA SORPRESA (Gildardo, 2026-10-25): *"De Angela se importaron muchas"*, y la
   * pantalla decia 8. Las dos cosas eran ciertas y la cifra sola no lo explicaba. Con el total al lado, el
   * 8 deja de parecer un defecto del import y se lee como lo que es: el consentimiento del HTML no tenia
   * casilla de investigacion, asi que esos pacientes no tienen nada que autorizar en Atlas.
   */
  importadasVigentes: number;
  /**
   * POR QUE QUEDAN FUERA LAS QUE QUEDAN FUERA.
   *
   * La cifra de excluidos ya estaba; la RAZON no, y sin ella el 38 % de consultas fuera no se podia cruzar
   * con el 13 % de pacientes que no autorizaron: son dos preguntas distintas (un paciente sin autorizacion
   * con tres consultas pone tres en el conteo de consultas). Por eso cada razon trae las dos cifras.
   */
  sinAutorizacionPorRazon: { razon: string; consultas: number; pacientes: number }[];
  /** La cohorte autorizada por version del motor, TAL COMO ESTA SELLADA: es lo que hay que poder citar. */
  porVersionDelMotor: { version: string; evaluaciones: number }[];
  /**
   * LA MISMA COHORTE AGRUPADA POR FAMILIA MAYOR, que es lo que decide la comparabilidad.
   *
   * ═══ POR QUE HACEN FALTA LAS DOS (Gildardo, 2026-10-25) ═══
   *
   * El panel avisaba *"la cohorte mezcla 2 versiones del motor"* sobre `1.0.0` y `anibise-1.4.0`, y eso
   * era FALSO: son la misma ciencia con dos grafias. El 2026-09-09 el motor se renombro de
   * `anibise-1.4.0` a `1.0.0` (un renombre de frontera: no se movio una sola cifra), y los diagnosticos
   * ya emitidos conservan la grafia vieja A PROPOSITO, porque el sello dice con que se calculo.
   *
   * La banda de trayectoria ya leia las dos formas igual (`mayorDelMotor`); la pantalla no. Un aviso que
   * dice "no son comparables" sobre cifras que SI lo son es peor que no avisar: hace desconfiar de la
   * cohorte entera. Asi que las dos agrupaciones usan la MISMA funcion que la banda, y la cruda se queda
   * para poder nombrar la grafia exacta de cada diagnostico.
   */
  porFamiliaDelMotor: { mayor: string; evaluaciones: number; grafias: string[] }[];
  /** `true` solo si de verdad hay dos familias MAYORES. Es lo unico que hace incomparables dos cifras. */
  mezclaFamilias: boolean;
  /**
   * ═══ LA MEZCLA ES MARGINAL: UN AVISO QUE EXAGERA ENSEÑA A IGNORARLO (2026-11-04) ═══
   *
   * La pantalla decia "2.x: 257 · 1.x: 1" EN AMBAR, y el aviso ("las cifras no son comparables") pesa
   * mucho mas de lo que el hecho merece: es UNA consulta de 258, la unica que quedo sellada con el motor
   * viejo y que no se puede reemitir. El aviso es cierto y la proporcion lo vuelve enganoso.
   *
   * ASI QUE POR DEBAJO DE UN UMBRAL SE DICE EN VOZ BAJA, nombrando la cifra, en vez de en ambar. Es la
   * misma leccion que cerro el aviso de anibise-1.4.0: un aviso que exagera se aprende a ignorar, y
   * entonces no avisa de nada el dia que importa.
   *
   * EL UMBRAL ES EL 5 % de la cohorte con diagnostico, y es NUESTRO, de presentacion: no decide sobre
   * ningun paciente ni cambia ninguna cifra (las dos familias siguen contadas y dichas). Lo unico que
   * decide es el color del aviso.
   */
  mezclaMarginal: boolean;
  /** La cohorte autorizada por mes de la medicion (hora de Colombia), de lo mas reciente a lo mas viejo. */
  porMes: { mes: string; evaluaciones: number }[];
  /**
   * ═══ LOS CONSOLIDADOS DE SU CNVResearch (cotejo del 2026-11-03) ═══
   *
   * Su modulo estratifica la cohorte por PAIS, CIUDAD, SEXO y PROFESIONAL, cada uno con las mismas cinco
   * columnas. Era lo mas grande que /obbia no tenia, y lo que convierte un panel de conteos en uno de
   * investigacion: *"cuantas consultas hay"* es una cifra; *"como se reparten"* es lo que decide si una
   * cohorte sirve para un analisis.
   *
   * SE AÑADEN LOS CUATRO EJES Y NADA MAS. Sus cinco columnas se respetan tal cual, porque son las que un
   * revisor espera ver en una tabla de caracterizacion.
   *
   * Y AQUI SIGUE SIN SALIR UNA FILA DE PACIENTE: son conteos por grupo. El unico eje que nombra a una
   * persona es el del PROFESIONAL, que es quien atiende y no el sujeto de estudio; su propio modulo lo
   * hace igual.
   */
  estratos: {
    eje: "pais" | "ciudad" | "sexo" | "profesional";
    filas: EstratoDeLaCohorte[];
  }[];
  /**
   * Las cifras que su panel muestra en tarjetas y /obbia no tenia: con espectro crudo (Z5-Z500), con
   * encuesta completa, con plan nutricional, y la edad media con su rango.
   *
   * LA EDAD SE MIDE A LA FECHA DE LA MEDICION, no a hoy: es la misma regla que ya rige la HC y el motor.
   * Una cohorte que envejece sola entre dos miradas no es una cohorte.
   */
  cifrasDeLaCohorte: {
    conEspectro: number;
    conEncuestaCompleta: number;
    conPlanNutricional: number;
    edadMedia: number | null;
    edadMinima: number | null;
    edadMaxima: number | null;
    /** Consultas cuya fecha de nacimiento da una edad imposible (menor de un año). Se cuentan, no se callan. */
    edadImposible: number;
  };
};

/** Una fila de consolidado, con las CINCO columnas de su CNVResearch. */
export type EstratoDeLaCohorte = {
  grupo: string;
  consultas: number;
  pacientes: number;
  conBis: number;
  conEspectro: number;
  edadMedia: number | null;
};

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL FILTRO ENTRA UNA VEZ, POR UNA CTE, Y TODAS LAS CONSULTAS LO HEREDAN
//
// ═══ EL DEFECTO QUE ESTO EVITA, Y ES EL UNICO QUE IMPORTA AQUI ═══
//
// Este lector hace CINCO idas a la base (totales, versiones, excluidas, meses, consolidados, extras). Si el
// predicado del filtro se escribiera en cada una, bastaria olvidarlo en una para que el panel mostrara
// cifras de DOS COHORTES DISTINTAS en la misma pantalla: la tarjeta diria 120 consultas y el consolidado
// sumaria 316, y las dos pareceran ciertas. Eso es peor que no filtrar, porque nadie puede notarlo.
//
// ASI QUE EL FILTRO NO SE REPARTE: se aplica UNA vez, al construir dos CTE (`cohorte` para la vista de
// investigacion y `universo` para la de vigentes), y las consultas dejan de nombrar las vistas. Que no
// puedan nombrarlas es lo que hace imposible el defecto, y es lo que vigila el candado.
//
// LAS CTE LLEVAN SOLO LAS COLUMNAS DE LA VISTA (`v.*`): el join a `patient_profiles` se hace aqui para
// poder filtrar por pais, ciudad, sexo y edad, pero no se exporta, para que las consultas de abajo sigan
// haciendo sus propios joins como antes y este cambio no tenga que tocarlas por dentro.
//
// LA CIUDAD SE COMPARA POR FORMA COMPARABLE, no por texto crudo: la tabla de ciudades funde "Guarne" con
// "Guarne, Antioquia" (ver `ciudades-de-la-cohorte`), asi que un filtro que comparara el crudo devolveria
// menos consultas de las que la propia fila dice tener. Se acepta la forma exacta o la forma mas un sufijo
// (el departamento pegado), que es la misma regla con la que la tabla funde.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
function predicadoDelFiltro(f: FiltroDeCohorte) {
  const partes = [];
  if (f.pais) partes.push(sql` and trim(pp.country) = ${f.pais}`);
  if (f.ciudad) {
    const forma = formaDeLaCiudadElegida(f.ciudad);
    const comparable = sql`regexp_replace(lower(translate(trim(pp.city), 'áéíóúÁÉÍÓÚüÜñÑ.,', 'aeiouAEIOUuUnN  ')), '\\s+', ' ', 'g')`;
    partes.push(sql` and (${comparable} = ${forma} or ${comparable} like ${forma + " %"})`);
  }
  if (f.sexo) partes.push(sql` and upper(coalesce(pp.sex, '')) = ${f.sexo}`);
  if (f.profesional) partes.push(sql` and v.professional_id = ${f.profesional}::uuid`);
  // LA EDAD, A LA FECHA DE LA MEDICION, igual que en los consolidados: una cohorte que envejece sola entre
  // dos miradas no es una cohorte.
  const edad = sql`extract(year from age(coalesce(v.dia, (v.created_at at time zone 'America/Bogota')::date), pp.birth_date))`;
  if (f.edadDesde != null) partes.push(sql` and ${edad} >= ${f.edadDesde}`);
  if (f.edadHasta != null) partes.push(sql` and ${edad} <= ${f.edadHasta}`);
  const dia = sql`coalesce(v.dia, (v.created_at at time zone 'America/Bogota')::date)`;
  if (f.desde) partes.push(sql` and ${dia} >= ${f.desde}::date`);
  if (f.hasta) partes.push(sql` and ${dia} <= ${f.hasta}::date`);
  if (f.soloConBis) partes.push(sql` and v.measurement_id is not null`);
  if (f.soloConEspectro) {
    partes.push(sql` and exists (
      select 1 from bis_raw_values r
       where r.measurement_id = v.measurement_id
         and r.variable_name in ('Z5 Ohm', 'Z500 Ohm'))`);
  }
  return partes.length === 0 ? sql`` : sql.join(partes, sql``);
}

export async function leerCohorteDeInvestigacion(
  filtro: FiltroDeCohorte = FILTRO_VACIO,
): Promise<CohorteDeInvestigacion> {
  const pred = predicadoDelFiltro(filtro);
  // LAS DOS CTE, que es lo unico que las consultas de abajo pueden nombrar. `es_consulta_hecha` entra aqui
  // tambien, asi que el `where es_consulta_hecha` que queda abajo es redundante y se deja: quita una
  // forma de romper esto por descuido al editar una consulta suelta.
  const CON = sql`
    with cohorte as (
      select v.*
        from public.evaluaciones_para_investigacion v
        left join patient_profiles pp on pp.patient_id = v.patient_id
       where v.es_consulta_hecha${pred}
    ), universo as (
      select v.*
        from public.evaluaciones_vigentes v
        left join patient_profiles pp on pp.patient_id = v.patient_id
       where v.es_consulta_hecha${pred}
    )`;
  // UNA SOLA IDA A LA BASE para los totales: son cuentas sobre las mismas dos vistas, y partirlas en cinco
  // consultas abriria la puerta a que dos cifras del mismo panel se midan en momentos distintos.
  const totales = await db.execute(sql`${CON}
    select
      (select count(*)::int from universo where es_consulta_hecha) as vigentes,
      (select count(*)::int from cohorte where es_consulta_hecha) as con_autorizacion,
      (select count(distinct patient_id)::int from cohorte where es_consulta_hecha) as pacientes_autorizados,
      (select count(*)::int from cohorte where es_consulta_hecha and diagnosis_id is not null) as con_diagnostico,
      (select count(*)::int from cohorte where es_consulta_hecha and importada) as importadas,
      (select count(*)::int from universo where es_consulta_hecha and importada) as importadas_vigentes,
      -- SIN AUTORIZACION, CONTADO DIRECTO (ver la nota del tipo: por resta heredaria la exclusion de
      -- calidad de dato y el rotulo diria que alguien no autorizo cuando si lo hizo).
      (select count(*)::int from universo v
        where v.es_consulta_hecha
          and not exists (select 1 from patient_consents c
                           where c.patient_id = v.patient_id
                             and c.consent_type = 'investigacion'
                             and c.revoked_at is null)) as sin_autorizacion,
      -- Y LAS QUE SALEN POR CALIDAD DE DATO: autorizadas, pero con la huella en otra consulta vigente.
      (select count(*)::int from universo v
        where v.es_consulta_hecha and v.huella_repetida
          and exists (select 1 from patient_consents c
                       where c.patient_id = v.patient_id
                         and c.consent_type = 'investigacion'
                         and c.revoked_at is null)) as fuera_por_huella,
      (select count(distinct v.huella)::int from universo v
        where v.es_consulta_hecha and v.huella_repetida) as grupos_de_huella,
      (select count(distinct v.patient_id)::int from universo v
        where v.es_consulta_hecha and v.huella_repetida) as pacientes_de_huella
  `);
  const t = (totales as unknown as Record<string, number>[])[0] ?? {};
  const vigentes = Number(t.vigentes ?? 0);
  const conAutorizacion = Number(t.con_autorizacion ?? 0);

  const versiones = await db.execute(sql`${CON}
    select coalesce(engine_version, 'sin diagnóstico') as version, count(*)::int as evaluaciones
      from cohorte
     where es_consulta_hecha
     group by 1
     order by 2 desc
  `);

  // ═══ EL DESGLOSE DE LOS EXCLUIDOS ═══
  //
  // EL ORDEN DE LOS `case` NO ES ARBITRARIO, y es la unica parte delicada: se pregunta PRIMERO por lo que
  // existe y dice no (hay una fila de investigacion, luego la revoco) y DESPUES por lo que no existe. Al
  // reves, un paciente que nunca firmo en Atlas se contaria como "firmo y no marco la casilla", y eso le
  // atribuiria una decision que nunca tomo. Es la misma regla que el orden de `nivelDeAnonimizacion`: el
  // error de omision tiene que caer del lado que NO afirma nada sobre la persona.
  const excluidas = await db.execute(sql`${CON}
    select
      case
        when exists (select 1 from patient_consents c
                      where c.patient_id = v.patient_id and c.consent_type = 'investigacion')
          then 'revocó la autorización'
        when not exists (select 1 from patient_consents c where c.patient_id = v.patient_id)
          then 'sin ningún consentimiento en Atlas (importada del HTML)'
        else 'firmó en Atlas y no marcó la casilla de investigación'
      end as razon,
      count(*)::int as consultas,
      count(distinct v.patient_id)::int as pacientes
      from universo v
     where v.es_consulta_hecha
       and not exists (select 1 from patient_consents c
                        where c.patient_id = v.patient_id
                          and c.consent_type = 'investigacion'
                          and c.revoked_at is null)
     group by 1
     order by 2 desc
  `);

  const meses = await db.execute(sql`${CON}
    select to_char(coalesce(dia, (created_at at time zone 'America/Bogota')::date), 'YYYY-MM') as mes,
           count(*)::int as evaluaciones
      from cohorte
     where es_consulta_hecha
     group by 1
     order by 1 desc
  `);

  // ═══ LOS CONSOLIDADOS, LOS CUATRO EN UNA SOLA IDA ═══
  //
  // UN `union all` SOBRE LA MISMA BASE y no cuatro consultas: son el mismo universo agrupado por cuatro
  // columnas, y partirlo abriria la puerta a que dos ejes del mismo panel se midan en momentos distintos.
  // Es el mismo criterio que ya rige los totales de arriba.
  //
  // LA EDAD SE CALCULA A LA FECHA DE LA MEDICION. `age()` sobre la fecha de nacimiento y el dia de la toma,
  // no sobre hoy: una cohorte que envejece sola entre dos miradas no es una cohorte, y es la regla que ya
  // cerro "una fecha ilegible que se vuelve edad cero".
  //
  // `coalesce(..., 'Sin dato')` EN LOS CUATRO EJES, que es lo que su modulo hace: una fila "Sin dato" dice
  // cuantas no se pueden estratificar; omitirlas haria que las columnas no sumen el total y nadie sabria
  // por que.
  const base = sql`
    from cohorte v
    left join patient_profiles pp on pp.patient_id = v.patient_id
    left join professional_profiles prof on prof.id = v.professional_id
    left join profiles perfil on perfil.id = prof.profile_id
    left join lateral (
      select 1 as tiene
        from bis_raw_values r
       where r.measurement_id = v.measurement_id
         and r.variable_name in ('Z5 Ohm', 'Z500 Ohm')
       limit 1
    ) espectro on true
   where v.es_consulta_hecha`;

  const columnas = sql`
      count(*)::int as consultas,
      count(distinct v.patient_id)::int as pacientes,
      count(*) filter (where v.measurement_id is not null)::int as con_bis,
      count(*) filter (where espectro.tiene is not null)::int as con_espectro,
      round(avg(
        extract(year from age(coalesce(v.dia, (v.created_at at time zone 'America/Bogota')::date), pp.birth_date))
      )::numeric, 1) as edad_media`;

  const estratos = await db.execute(sql`${CON}
      select 'pais' as eje, coalesce(nullif(trim(pp.country), ''), 'Sin dato') as grupo, ${columnas} ${base} group by 1, 2
    union all
      select 'ciudad', coalesce(nullif(trim(pp.city), ''), 'Sin dato'), ${columnas} ${base} group by 1, 2
    union all
      select 'sexo',
             case upper(coalesce(pp.sex, '')) when 'M' then 'Masculino' when 'F' then 'Femenino' else 'Sin dato' end,
             ${columnas} ${base} group by 1, 2
    union all
      select 'profesional', coalesce(nullif(trim(perfil.full_name), ''), 'Sin dato'), ${columnas} ${base} group by 1, 2
     order by 1, 3 desc
  `);

  // ═══ LAS CIFRAS DE TARJETA QUE SU PANEL TIENE Y /obbia NO TENIA ═══
  //
  // `conEncuestaCompleta` y `conPlanNutricional` NO se derivan de la vista (que no sabe de encuestas ni de
  // protocolos): se preguntan por `exists`, que es lo que hace el roster y lo que evita traer las filas.
  const [extras] = (await db.execute(sql`${CON}
    select
      count(*) filter (where exists (
        select 1 from bis_raw_values r
         where r.measurement_id = v.measurement_id and r.variable_name in ('Z5 Ohm', 'Z500 Ohm')))::int as con_espectro,
      count(*) filter (where exists (
        select 1 from survey_responses sr where sr.evaluation_id = v.id))::int as con_encuesta,
      count(*) filter (where exists (
        select 1 from treatments t
          join diagnoses d on d.id = t.diagnosis_id
         where d.evaluation_id = v.id))::int as con_plan,
      -- ═══ LA EDAD, SIN LAS FECHAS IMPOSIBLES (Santiago, 2026-11-03) ═══
      --
      -- El panel decia "Edad media 43.5 · rango 0-78", y ese 0 no es un paciente: es UNA fecha de
      -- nacimiento con el año 2026 en una consulta medida en 2026. Un recien nacido no se puede medir en
      -- un Biody: hay que estar de pie sobre los electrodos.
      --
      -- EL CORTE ES 1 AÑO Y SOLO ATRAPA LO IMPOSIBLE, que es la regla de CLAUDE.md para un cinturon sin
      -- fuente ("tan ancho que solo atrape lo imposible, nunca lo improbable"). Los pacientes de 7 años
      -- (nacidos en 2018 y 2019) SI entran: son reales, son los mismos de la pregunta 14 del documento de
      -- dudas, y excluirlos seria esconder la cohorte pediatrica en vez de contarla.
      --
      -- Y LO EXCLUIDO SE CUENTA, no se quita en silencio: edad_imposible va a la pantalla.
      --
      -- LA EDAD SE CALCULA UNA VEZ, en la subconsulta de abajo. Escrita cuatro veces en linea, la formula
      -- ocupaba mas que todo lo demas junto y cualquier ajuste habria que hacerlo en cuatro sitios.
      round(avg(edad) filter (where edad >= 1)::numeric, 1) as edad_media,
      min(edad) filter (where edad >= 1)::int as edad_min,
      max(edad) filter (where edad >= 1)::int as edad_max,
      count(*) filter (where edad < 1)::int as edad_imposible
      from (
        select v.id,
               v.measurement_id,
               extract(year from age(
                 coalesce(v.dia, (v.created_at at time zone 'America/Bogota')::date),
                 pp.birth_date
               )) as edad
          from cohorte v
          left join patient_profiles pp on pp.patient_id = v.patient_id
         where v.es_consulta_hecha
      ) v
  `)) as unknown as Record<string, number | null>[];

  // LA FAMILIA SE CALCULA EN TS CON LA FUNCION DE LA BANDA, no con un `split` en SQL. Si el criterio de
  // comparabilidad cambia, cambia en un sitio y las dos superficies lo siguen.
  const crudas = (versiones as unknown as { version: string; evaluaciones: number }[]).map((r) => ({
    version: r.version,
    evaluaciones: Number(r.evaluaciones),
  }));
  const familias = new Map<string, { evaluaciones: number; grafias: string[] }>();
  for (const v of crudas) {
    // `sin diagnóstico` no es una version: no tiene mayor y no entra a la agrupacion por familia.
    const mayor = mayorDelMotor(v.version);
    if (mayor === null) continue;
    const ya = familias.get(mayor) ?? { evaluaciones: 0, grafias: [] };
    ya.evaluaciones += v.evaluaciones;
    ya.grafias.push(v.version);
    familias.set(mayor, ya);
  }
  const porFamiliaDelMotor = [...familias.entries()]
    .map(([mayor, f]) => ({ mayor, evaluaciones: f.evaluaciones, grafias: f.grafias.sort() }))
    .sort((a, b) => b.evaluaciones - a.evaluaciones);

  return {
    vigentes,
    conAutorizacion,
    sinAutorizacion: Number(t.sin_autorizacion ?? 0),
    fueraPorHuellaRepetida: {
      consultas: Number(t.fuera_por_huella ?? 0),
      grupos: Number(t.grupos_de_huella ?? 0),
      pacientes: Number(t.pacientes_de_huella ?? 0),
    },
    porFamiliaDelMotor,
    mezclaFamilias: porFamiliaDelMotor.length > 1,
    // La minoria se mide contra la suma de las familias (no contra `conAutorizacion`): las consultas sin
    // diagnostico no tienen motor, asi que meterlas en el denominador diluiria la proporcion a conveniencia.
    mezclaMarginal: (() => {
      if (porFamiliaDelMotor.length < 2) return false;
      const total = porFamiliaDelMotor.reduce((n, f) => n + f.evaluaciones, 0);
      const minoria = Math.min(...porFamiliaDelMotor.map((f) => f.evaluaciones));
      return total > 0 && minoria / total < 0.05;
    })(),
    pacientesAutorizados: Number(t.pacientes_autorizados ?? 0),
    conDiagnostico: Number(t.con_diagnostico ?? 0),
    importadas: Number(t.importadas ?? 0),
    importadasVigentes: Number(t.importadas_vigentes ?? 0),
    sinAutorizacionPorRazon: (
      excluidas as unknown as { razon: string; consultas: number; pacientes: number }[]
    ).map((r) => ({
      razon: r.razon,
      consultas: Number(r.consultas),
      pacientes: Number(r.pacientes),
    })),
    porVersionDelMotor: crudas,
    porMes: (meses as unknown as { mes: string; evaluaciones: number }[]).map((r) => ({
      mes: r.mes,
      evaluaciones: Number(r.evaluaciones),
    })),
    estratos: (["pais", "ciudad", "sexo", "profesional"] as const).map((eje) => {
      const filas = (estratos as unknown as Record<string, string | number | null>[])
        .filter((r) => r.eje === eje)
        .map((r) => ({
          grupo: String(r.grupo),
          consultas: Number(r.consultas),
          pacientes: Number(r.pacientes),
          conBis: Number(r.con_bis),
          conEspectro: Number(r.con_espectro),
          edadMedia: r.edad_media == null ? null : Number(r.edad_media),
        }));
      // LA CIUDAD ES TEXTO LIBRE, y la misma salia en tres filas ("Guarne" / "Guarne, Antioquia", tres
      // "San Carlos"). Se unifica SOLO donde la forma corta ya existe por si sola, que es conservador a
      // proposito: hay municipios homonimos en departamentos distintos. Ver `ciudades-de-la-cohorte`.
      return { eje, filas: eje === "ciudad" ? ciudadesUnificadas(filas) : filas };
    }),
    cifrasDeLaCohorte: {
      conEspectro: Number(extras?.con_espectro ?? 0),
      conEncuestaCompleta: Number(extras?.con_encuesta ?? 0),
      conPlanNutricional: Number(extras?.con_plan ?? 0),
      edadMedia: extras?.edad_media == null ? null : Number(extras.edad_media),
      edadMinima: extras?.edad_min == null ? null : Number(extras.edad_min),
      edadMaxima: extras?.edad_max == null ? null : Number(extras.edad_max),
      edadImposible: Number(extras?.edad_imposible ?? 0),
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS OPCIONES DE LOS DESPLEGABLES  ·  SIN FILTRAR, A PROPOSITO
//
// Si se construyeran con la cohorte YA filtrada, elegir "Medellin" dejaria el desplegable de ciudades con
// una sola opcion y no habria forma de cambiar de ciudad sin editar la URL a mano. El filtro cambia las
// CIFRAS, no las salidas.
//
// LAS CIUDADES SE FUNDEN con la misma regla que la tabla (`ciudadesUnificadas`), porque es lo que la
// pantalla muestra: ofrecer "Guarne" y "Guarne, Antioquia" como dos opciones distintas, cuando la tabla
// las cuenta juntas, haria que elegir una devolviera menos consultas de las que su fila dice.
//
// Y EL PROFESIONAL VA POR ID: dos profesionales pueden llamarse igual, y el nombre es lo que se muestra.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
export async function leerOpcionesDelFiltro(): Promise<{
  paises: string[];
  ciudades: string[];
  profesionales: { id: string; nombre: string }[];
}> {
  const filas = await db.execute(sql`
    select 'pais' as eje, coalesce(nullif(trim(pp.country), ''), '') as valor, '' as id
      from public.evaluaciones_para_investigacion v
      left join patient_profiles pp on pp.patient_id = v.patient_id
     where v.es_consulta_hecha and nullif(trim(pp.country), '') is not null
     group by 2
    union all
    select 'ciudad', coalesce(nullif(trim(pp.city), ''), ''), ''
      from public.evaluaciones_para_investigacion v
      left join patient_profiles pp on pp.patient_id = v.patient_id
     where v.es_consulta_hecha and nullif(trim(pp.city), '') is not null
     group by 2
    union all
    select 'profesional', coalesce(nullif(trim(perfil.full_name), ''), ''), prof.id::text
      from public.evaluaciones_para_investigacion v
      join professional_profiles prof on prof.id = v.professional_id
      left join profiles perfil on perfil.id = prof.profile_id
     where v.es_consulta_hecha and nullif(trim(perfil.full_name), '') is not null
     group by 2, 3
     order by 1, 2
  `);
  const lista = filas as unknown as { eje: string; valor: string; id: string }[];
  const de = (eje: string) => lista.filter((f) => f.eje === eje).map((f) => f.valor);
  // Las ciudades pasan por la misma union que la tabla: se reusa `ciudadesUnificadas` con filas minimas,
  // para no escribir la regla dos veces (es la unica forma de que no puedan divergir).
  const ciudades = ciudadesUnificadas(
    de("ciudad").map((grupo) => ({
      grupo,
      consultas: 1,
      pacientes: 1,
      conBis: 0,
      conEspectro: 0,
      edadMedia: null,
    })),
  ).map((f) => f.grupo);
  return {
    paises: [...new Set(de("pais"))].sort((a, b) => a.localeCompare(b, "es")),
    ciudades: ciudades.sort((a, b) => a.localeCompare(b, "es")),
    profesionales: lista
      .filter((f) => f.eje === "profesional")
      .map((f) => ({ id: f.id, nombre: f.valor }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}
