import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// ═══ A QUE TRATAMIENTO SE ATA UNA VENTA DE /pagos (2026-09-29) ═══
//
// EL HUECO QUE CIERRA, planteado por Santiago: una venta hecha en Tratamiento guarda su `treatment_id` y por
// el llega al diagnostico y a la evaluacion. Una hecha en /pagos nace SIN NADA, y /pagos existe justamente
// para el paciente que vuelve solo a comprar, que es la compra que mas dice sobre si el producto le sirvio.
//
// ── LO QUE SE VERIFICO ANTES DE DISEÑAR, y cambia la propuesta ──
//
// UN TRATAMIENTO NO SE CIERRA. Su enum tiene DOS estados y nada mas: `draft` y `approved`. Asi que "el ultimo
// abierto" no existe como concepto, y no se puede elegir por ahi.
//
// Lo que si existe y sirve:
//   · `approved` = hay una PRESCRIPCION de verdad (un draft es una consulta en curso, sin prescribir);
//   · su FECHA, que es lo unico que dice si atarle la compra de hoy miente o no;
//   · y que su evaluacion no este REEMPLAZADA (una evaluacion corregida tiene su tratamiento superado).
//
// ── Y POR ESO NO SE PRESELECCIONA NINGUNO ──
//
// El caso que hay que evitar no es que la venta quede suelta: es que el profesional elija CUALQUIERA para
// poder cobrar. Un desplegable preseleccionado con el ultimo tratamiento produce exactamente eso, y el dato
// malo se ve igual que el bueno. Asi que la pantalla muestra la FECHA de cada uno, no elige por nadie, y deja
// una salida explicita ("queda suelta") con su motivo.

export type TratamientoParaAtar = {
  treatmentId: string;
  evaluationId: string;
  /** AAAA-MM-DD de la aprobacion, o de la apertura si es un borrador. Es lo que dice si atarle la compra de hoy miente. */
  fecha: string;
  /** Un borrador es una consulta EN CURSO: no prescribio todavia, pero la compra puede ser de esa consulta. */
  esBorrador: boolean;
  /** Dias desde la aprobacion, para poder avisar cuando es viejo sin que nadie reste fechas. */
  diasDesde: number;
  /** Los nutraceuticos que ESE tratamiento prescribio, para reconocerlo de un golpe. */
  prescritos: string | null;
};

/**
 * Los tratamientos a los que se le puede atar una compra, del mas reciente al mas viejo.
 *
 * NO SE OFRECEN LOS REEMPLAZADOS: el tratamiento de una evaluacion corregida ya fue sustituido por el de la
 * correccion, y atarle una compra seria colgarla de algo que el sistema mismo considera superado.
 *
 * LOS BORRADORES SI SE OFRECEN, MARCADOS. Se verifico en la base: hoy TODOS los tratamientos locales son
 * borradores. Excluirlos dejaria a un paciente cuya consulta esta en curso sin nada a que atar, y entonces el
 * profesional elegiria "suelta" por no tener opcion: justo el dato malo que esto viene a evitar.
 */
export async function tratamientosParaAtar(patientId: string): Promise<TratamientoParaAtar[]> {
  const filas = await db.execute<{
    treatment_id: string;
    evaluation_id: string;
    fecha: string;
    dias: number;
    es_borrador: boolean;
    prescritos: string | null;
  }>(sql`
    select t.id as treatment_id,
           e.id as evaluation_id,
           (coalesce(t.approved_at, t.created_at) at time zone 'America/Bogota')::date::text as fecha,
           (current_date - (coalesce(t.approved_at, t.created_at) at time zone 'America/Bogota')::date)::int as dias,
           t.status = 'draft' as es_borrador,
           (select string_agg(n.name, ', ' order by n.name)
              from treatment_nutraceuticals tn
              join nutraceuticals n on n.id = tn.nutraceutical_id
             where tn.treatment_id = t.id) as prescritos
      from treatments t
      join diagnoses d on d.id = t.diagnosis_id
      join evaluations e on e.id = d.evaluation_id
     where e.patient_id = ${patientId}
       and e.superseded_at is null
     order by coalesce(t.approved_at, t.created_at) desc
     limit 20`);
  return filas.map((f) => ({
    treatmentId: f.treatment_id,
    evaluationId: f.evaluation_id,
    fecha: f.fecha,
    esBorrador: f.es_borrador === true,
    diasDesde: Number(f.dias),
    prescritos: f.prescritos,
  }));
}

/**
 * Los tratamientos de VARIOS pacientes, en una sola consulta, para que el formulario pueda ofrecerlos sin ir
 * al servidor cada vez que se cambia de paciente.
 *
 * SE ACOTA A LOS PACIENTES QUE LA PANTALLA YA LISTA, no a todos: con un roster grande, traer los tratamientos
 * de todos seria pagar por lo que nadie va a mirar. Y aunque la lista es de la sesion, el limite existe
 * igual: es la leccion del corte silencioso de PostgREST a las 1000 filas.
 */
export async function tratamientosDeVariosPacientes(
  patientIds: string[],
): Promise<Map<string, TratamientoParaAtar[]>> {
  const salida = new Map<string, TratamientoParaAtar[]>();
  // Los ids se interpolan, asi que se comprueba su forma: lo que no sea un UUID no llega a la consulta.
  const ids = patientIds.filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  );
  if (ids.length === 0) return salida;

  const filas = await db.execute<{
    patient_id: string;
    treatment_id: string;
    evaluation_id: string;
    fecha: string;
    dias: number;
    es_borrador: boolean;
    prescritos: string | null;
  }>(sql`
    select e.patient_id,
           t.id as treatment_id,
           e.id as evaluation_id,
           (coalesce(t.approved_at, t.created_at) at time zone 'America/Bogota')::date::text as fecha,
           (current_date - (coalesce(t.approved_at, t.created_at) at time zone 'America/Bogota')::date)::int as dias,
           t.status = 'draft' as es_borrador,
           (select string_agg(n.name, ', ' order by n.name)
              from treatment_nutraceuticals tn
              join nutraceuticals n on n.id = tn.nutraceutical_id
             where tn.treatment_id = t.id) as prescritos
      from treatments t
      join diagnoses d on d.id = t.diagnosis_id
      join evaluations e on e.id = d.evaluation_id
     where e.patient_id = any(${sql.raw(`array['${ids.join("','")}']::uuid[]`)})
       and e.superseded_at is null
     order by e.patient_id, coalesce(t.approved_at, t.created_at) desc`);

  for (const f of filas) {
    const lista = salida.get(f.patient_id) ?? [];
    lista.push({
      treatmentId: f.treatment_id,
      evaluationId: f.evaluation_id,
      fecha: f.fecha,
      esBorrador: f.es_borrador === true,
      diasDesde: Number(f.dias),
      prescritos: f.prescritos,
    });
    salida.set(f.patient_id, lista);
  }
  return salida;
}

/**
 * ¿El tratamiento que se pretende atar es de ese paciente, esta aprobado y no fue reemplazado?
 *
 * EL SERVIDOR LO VUELVE A COMPROBAR, y no por desconfianza del formulario: el desplegable se arma al abrir la
 * pantalla, y entre eso y el cobro alguien puede haber corregido esa evaluacion. Atar la compra a un
 * tratamiento superado seria colgarla de algo que el sistema ya considera sustituido.
 */
export async function esTratamientoAtable(patientId: string, treatmentId: string): Promise<boolean> {
  const [f] = await db.execute<{ ok: boolean }>(sql`
    select true as ok
      from treatments t
      join diagnoses d on d.id = t.diagnosis_id
      join evaluations e on e.id = d.evaluation_id
     where t.id = ${treatmentId}
       and e.patient_id = ${patientId}
       and e.superseded_at is null`);
  return f?.ok === true;
}
