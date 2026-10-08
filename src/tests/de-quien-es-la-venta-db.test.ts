import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

// ═══ DE QUIÉN ES CADA VENTA, Y EL EMBED QUE LO TRAE (Santiago, smoke del 2026-10-07) ═══
//
// ── LO QUE PIDIÓ ──
//
// *"Me doy cuenta que aquí falta decir a cuál paciente se le entregó y si hace parte de una evaluación (y cuál)
// o no, ya que uno se confunde fácil."* Nueve líneas de 107.100 del mismo producto, indistinguibles.
//
// ── POR QUÉ ESTO VA CONTRA LA BASE REAL Y NO ES UN TEST DE PANTALLA ──
//
// Porque para decirlo hubo que añadir un embed de PostgREST (`transactions -> patients`), y esa es la familia de
// defectos que CLAUDE.md marca como INVISIBLE A TSC: una SEGUNDA relación hacia una tabla ya referenciada vuelve
// AMBIGUOS los embeds que ya existían, y falla en RUNTIME con "Could not embed because more than one
// relationship was found". Ya pasó: un FK nuevo `rut_verified_by -> profiles` rompió tres embeds de comodato,
// faltantes y remesa (2026-08-12), ninguno relacionado con el FK nuevo.
//
// ASÍ QUE LO QUE SE VIGILA ES LA PRECONDICIÓN DEL EMBED, que es lo único que se puede vigilar antes de que
// rompa: que siga habiendo UNA sola relación de `transactions` a `patients`. El día que alguien añada una
// segunda (un "paciente que reclama", un "paciente que recibe"), este candado truena ANTES del runtime y dice
// qué hay que desambiguar.

if (!process.env.DATABASE_URL) process.loadEnvFile?.(".env.local");
const HAS_DB = Boolean(process.env.DATABASE_URL);
const sql = HAS_DB ? postgres(process.env.DATABASE_URL!, { max: 1, prepare: false }) : null;

afterAll(async () => {
  await sql?.end();
});

/** Las FK de `tabla` que apuntan a `destino`, con la columna de origen. */
async function relaciones(tabla: string, destino: string): Promise<string[]> {
  const filas = await sql!`
    select a.attname as columna
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_class d on d.oid = c.confrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(c.conkey) as k(attnum) on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
     where c.contype = 'f'
       and n.nspname = 'public'
       and t.relname = ${tabla}
       and d.relname = ${destino}
     order by 1`;
  return filas.map((f) => String(f.columna));
}

describe.skipIf(!HAS_DB)("el historial puede decir de quién es la venta (BD real)", () => {
  it("transactions tiene UNA sola relacion a patients, que es lo que hace inequivoco el embed", async () => {
    const cols = await relaciones("transactions", "patients");
    expect(
      cols,
      `transactions -> patients tiene ${cols.length} relaciones (${cols.join(", ")}). Con mas de una, el embed ` +
        `\`patients(...)\` de listTransactions se vuelve AMBIGUO y la pantalla /pagos revienta en runtime sin ` +
        `que tsc diga nada. Desambigualo con el hint \`patients!<columna>(...)\` en TODOS los embeds de esa ` +
        `tabla, no solo en el nuevo.`,
    ).toHaveLength(1);
    expect(cols[0]).toBe("patient_id");
  });

  it("y el camino a la consulta sigue siendo de dos saltos, que es por lo que NO se embebe", async () => {
    // Si algun dia `transactions` gana un `evaluation_id` propio, este test truena y el mensaje dice que ya se
    // puede leer directo: `consultasDeLasVentas` existe SOLO porque hoy hay que pasar por treatments ->
    // diagnoses, y mantenerlo cuando sobre seria complejidad sin razon.
    const directo = await relaciones("transactions", "evaluations");
    expect(
      directo,
      "transactions ya tiene relacion directa con evaluations: `consultasDeLasVentas` (dos consultas en cadena) " +
        "sobra, y se puede leer la consulta de una.",
    ).toHaveLength(0);
    // Y los dos saltos que de verdad se recorren existen.
    expect(await relaciones("treatments", "diagnoses")).toHaveLength(1);
    const deDiagnosticoAEvaluacion = await relaciones("diagnoses", "evaluations");
    expect(deDiagnosticoAEvaluacion).toContain("evaluation_id");
  });

  it("y la consulta del historial corre de verdad contra la base, con el embed puesto", async () => {
    // EL EMBED SE PRUEBA EJECUTANDOLO. Las dos comprobaciones de arriba vigilan la precondicion; esta comprueba
    // que las columnas que la pantalla pide existen y se pueden traer juntas. Se hace por SQL (no por PostgREST,
    // que necesitaria sesion), con el MISMO camino de columnas que el embed declara.
    const filas = await sql!`
      select t.id,
             t.treatment_id,
             pa.document_type,
             pa.document_number,
             pp.first_name,
             pp.last_name
        from transactions t
        left join patients pa on pa.id = t.patient_id
        left join patient_profiles pp on pp.patient_id = pa.id
       limit 5`;
    expect(Array.isArray(filas)).toBe(true);
  });
});
