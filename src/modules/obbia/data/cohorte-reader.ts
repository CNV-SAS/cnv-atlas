import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

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
  /** Las que quedan fuera por no tener la autorizacion vigente. */
  sinAutorizacion: number;
  /** Pacientes distintos en la cohorte autorizada. */
  pacientesAutorizados: number;
  /** De la cohorte autorizada, cuantas tienen diagnostico sellado (las unicas con indicadores). */
  conDiagnostico: number;
  /** Importadas del HTML: la procedencia es lo primero que se pregunta en un analisis de calidad. */
  importadas: number;
  /** La cohorte autorizada por version del motor: mezclar mayores es comparar lo incomparable. */
  porVersionDelMotor: { version: string; evaluaciones: number }[];
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
      (select count(*)::int from public.evaluaciones_para_investigacion where es_consulta_hecha and importada) as importadas
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

  const meses = await db.execute(sql`
    select to_char(coalesce(dia, (created_at at time zone 'America/Bogota')::date), 'YYYY-MM') as mes,
           count(*)::int as evaluaciones
      from public.evaluaciones_para_investigacion
     where es_consulta_hecha
     group by 1
     order by 1 desc
  `);

  return {
    vigentes,
    conAutorizacion,
    sinAutorizacion: vigentes - conAutorizacion,
    pacientesAutorizados: Number(t.pacientes_autorizados ?? 0),
    conDiagnostico: Number(t.con_diagnostico ?? 0),
    importadas: Number(t.importadas ?? 0),
    porVersionDelMotor: (versiones as unknown as { version: string; evaluaciones: number }[]).map((r) => ({
      version: r.version,
      evaluaciones: Number(r.evaluaciones),
    })),
    porMes: (meses as unknown as { mes: string; evaluaciones: number }[]).map((r) => ({
      mes: r.mes,
      evaluaciones: Number(r.evaluaciones),
    })),
  };
}
