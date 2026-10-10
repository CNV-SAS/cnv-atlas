import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses, evaluations } from "@/db/schema";

// CUANTOS DIAGNOSTICOS VIGENTES TIENE UN PACIENTE.
//
// ── PARA QUE SIRVE, Y POR QUE ES UNA CIFRA Y NO UN BOOLEANO ───────────────────────────────────────
//
// Para que el aviso de corregir el sexo diga algo CONCRETO. "Esto no rehace los diagnosticos ya generados"
// es cierto pero no le dice al profesional si le queda trabajo; "este paciente tiene 2 diagnosticos
// generados con el sexo anterior" si, y lo manda al camino de correccion que ya existe.
//
// ── POR QUE DRIZZLE Y NO EL EMBED DE PostgREST ────────────────────────────────────────────────────
//
// Porque un embed que la RLS no alcance devuelve una lista VACIA, sin error: el aviso diria "no hay
// diagnosticos" justo cuando los hay, que es el peor desenlace posible para una advertencia clinica. La
// ownership ya se verifico un paso antes leyendo el paciente bajo RLS (`getPatientDetail`), que es el mismo
// patron del escritor del sexo; esto solo cuenta filas de un paciente que ya se demostro que es suyo.
//
// SE CUENTAN LAS VIGENTES. Una evaluacion reemplazada por una correccion ya lleva su diagnostico rehecho:
// contarla diria que hay trabajo pendiente donde no hay.
export async function contarDiagnosticosDelPaciente(patientId: string): Promise<number> {
  const [fila] = await db
    .select({ n: count() })
    .from(diagnoses)
    .innerJoin(evaluations, eq(diagnoses.evaluationId, evaluations.id))
    .where(
      and(
        eq(evaluations.patientId, patientId),
        isNull(evaluations.supersededAt),
        isNull(evaluations.retiradaAt),
      ),
    );
  return Number(fila?.n ?? 0);
}
