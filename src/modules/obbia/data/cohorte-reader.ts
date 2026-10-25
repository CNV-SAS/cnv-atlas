import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { mayorDelMotor } from "@/modules/followups/services/eb-trajectory";

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
  /** La cohorte autorizada por mes de la medicion (hora de Colombia), de lo mas reciente a lo mas viejo. */
  porMes: { mes: string; evaluaciones: number }[];
};

export async function leerCohorteDeInvestigacion(): Promise<CohorteDeInvestigacion> {
  // UNA SOLA IDA A LA BASE para los totales: son cuentas sobre las mismas dos vistas, y partirlas en cinco
  // consultas abriria la puerta a que dos cifras del mismo panel se midan en momentos distintos.
  const totales = await db.execute(sql`
    select
      (select count(*)::int from public.evaluaciones_vigentes where es_consulta_hecha) as vigentes,
      (select count(*)::int from public.evaluaciones_para_investigacion where es_consulta_hecha) as con_autorizacion,
      (select count(distinct patient_id)::int from public.evaluaciones_para_investigacion where es_consulta_hecha) as pacientes_autorizados,
      (select count(*)::int from public.evaluaciones_para_investigacion where es_consulta_hecha and diagnosis_id is not null) as con_diagnostico,
      (select count(*)::int from public.evaluaciones_para_investigacion where es_consulta_hecha and importada) as importadas,
      (select count(*)::int from public.evaluaciones_vigentes where es_consulta_hecha and importada) as importadas_vigentes,
      -- SIN AUTORIZACION, CONTADO DIRECTO (ver la nota del tipo: por resta heredaria la exclusion de
      -- calidad de dato y el rotulo diria que alguien no autorizo cuando si lo hizo).
      (select count(*)::int from public.evaluaciones_vigentes v
        where v.es_consulta_hecha
          and not exists (select 1 from patient_consents c
                           where c.patient_id = v.patient_id
                             and c.consent_type = 'investigacion'
                             and c.revoked_at is null)) as sin_autorizacion,
      -- Y LAS QUE SALEN POR CALIDAD DE DATO: autorizadas, pero con la huella en otra consulta vigente.
      (select count(*)::int from public.evaluaciones_vigentes v
        where v.es_consulta_hecha and v.huella_repetida
          and exists (select 1 from patient_consents c
                       where c.patient_id = v.patient_id
                         and c.consent_type = 'investigacion'
                         and c.revoked_at is null)) as fuera_por_huella,
      (select count(distinct v.huella)::int from public.evaluaciones_vigentes v
        where v.es_consulta_hecha and v.huella_repetida) as grupos_de_huella,
      (select count(distinct v.patient_id)::int from public.evaluaciones_vigentes v
        where v.es_consulta_hecha and v.huella_repetida) as pacientes_de_huella
  `);
  const t = (totales as unknown as Record<string, number>[])[0] ?? {};
  const vigentes = Number(t.vigentes ?? 0);
  const conAutorizacion = Number(t.con_autorizacion ?? 0);

  const versiones = await db.execute(sql`
    select coalesce(engine_version, 'sin diagnóstico') as version, count(*)::int as evaluaciones
      from public.evaluaciones_para_investigacion
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
  const excluidas = await db.execute(sql`
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
      from public.evaluaciones_vigentes v
     where v.es_consulta_hecha
       and not exists (select 1 from patient_consents c
                        where c.patient_id = v.patient_id
                          and c.consent_type = 'investigacion'
                          and c.revoked_at is null)
     group by 1
     order by 2 desc
  `);

  const meses = await db.execute(sql`
    select to_char(coalesce(dia, (created_at at time zone 'America/Bogota')::date), 'YYYY-MM') as mes,
           count(*)::int as evaluaciones
      from public.evaluaciones_para_investigacion
     where es_consulta_hecha
     group by 1
     order by 1 desc
  `);

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
  };
}
