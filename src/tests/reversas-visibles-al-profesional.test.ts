import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// CANDADO DE LA CAPA DE DATOS: EL PROFESIONAL VE LAS REVERSAS DE SUS VENTAS (0194).
//
// ═══ LA LECCION, QUE VALE MAS QUE EL DEFECTO ═══
//
// El 2026-09-29 la tarjeta de ventas bajaba en admin y NO en el profesional, y quedo con MENOS ventas el
// admin que el profesional. La tarjeta es UN SOLO lector para los dos roles, y ya habia un candado que
// comprobaba que las dos pantallas usaran la misma cuenta. Ese candado estaba en lo cierto.
//
// LO QUE FALTABA ERA MIRAR LA CAPA DE DATOS: `sale_reversals` solo la leian admin, direccion y soporte, asi
// que para el profesional la consulta devolvia CERO FILAS. El mismo codigo, con datos distintos, daba otra
// cifra. VERIFICAR EL CAMINO DEL CODIGO NO VERIFICA EL CAMINO DE LOS DATOS.
//
// Por eso este candado corre con RLS DE VERDAD (rol `authenticated` y el claim de sub, como PostgREST), y no
// comprueba que exista una politica: comprueba que el profesional VEA la fila.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const HAS_DB = Boolean(process.env.DATABASE_URL);
const sql = HAS_DB ? postgres(process.env.DATABASE_URL!, { max: 1, prepare: false }) : (null as never);

/** Corre `fn` como ese usuario, con RLS activa, y revierte al terminar. */
async function comoUsuario(userId: string, fn: (tx: postgres.TransactionSql) => Promise<void>) {
  await sql.begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await fn(tx);
  });
}

describe.skipIf(!HAS_DB)("las reversas de sus ventas, con RLS real", () => {
  let profesionalUserId: string;
  let otroUserId: string;
  let reversaPropia: string;
  let reversaAjena: string;
  const creadas: string[] = [];

  beforeAll(async () => {
    // Dos profesionales distintos: uno dueño de la venta y otro que no.
    const profs = await sql`
      select pp.id, pp.profile_id from public.professional_profiles pp
       order by pp.created_at limit 2`;
    profesionalUserId = profs[0].profile_id;
    otroUserId = profs[1]?.profile_id ?? profs[0].profile_id;

    // Una venta de cada uno, con su reversa devuelta.
    for (const [i, prof] of profs.entries()) {
      const [t] = await sql`
        insert into public.transactions (organization_id, professional_id, status, amount, currency,
                                         payment_method, wompi_env, idempotency_key)
        select p.organization_id, ${prof.id}, 'paid', '100000', 'COP', 'efectivo', 'test',
               ${`test-rls-reversa-${Date.now()}-${i}`}
          from public.profiles p where p.id = ${prof.profile_id}
        returning id`;
      // UNA DEVOLUCION EXIGE SU LINEA Y SUS UNIDADES (CHECK de la 0175): es por unidades de una linea, no
      // por la venta entera, y la base no deja registrarla a medias.
      const [item] = await sql`
        insert into public.transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
        values (${t.id}, '77777777-7777-7777-7777-777777777702', 2, '50000') returning id`;
      const [r] = await sql`
        insert into public.sale_reversals (transaction_id, kind, state, product_ownership, opened_by,
                                          resolved_at, resolved_by, transaction_item_id, returned_quantity,
                                          debited_amount, note)
        values (${t.id}, 'devolucion', 'devuelta', 'propio', ${prof.profile_id}, now(), ${prof.profile_id},
                ${item.id}, 1, '40000', 'candado de RLS')
        returning id`;
      creadas.push(t.id);
      if (i === 0) reversaPropia = r.id;
      else reversaAjena = r.id;
    }
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    for (const id of creadas) {
      await sql`delete from public.sale_reversals where transaction_id = ${id}`;
      await sql`delete from public.transaction_items where transaction_id = ${id}`;
      await sql`delete from public.transactions where id = ${id}`;
    }
    await sql.end();
  });

  it("el profesional VE la reversa de su propia venta", async () => {
    await comoUsuario(profesionalUserId, async (tx) => {
      const filas = await tx`select id from public.sale_reversals where id = ${reversaPropia}`;
      expect(filas).toHaveLength(1);
    });
  });

  // SOLO LAS SUYAS: la reversa de otro sigue siendo de CNV. Sin este caso, "que el profesional las vea" se
  // podria cumplir abriendo la tabla entera.
  it("y NO ve la de otro profesional", async () => {
    if (reversaAjena == null || otroUserId === profesionalUserId) return;
    await comoUsuario(profesionalUserId, async (tx) => {
      const filas = await tx`select id from public.sale_reversals where id = ${reversaAjena}`;
      expect(filas).toHaveLength(0);
    });
  });

  // Y LA CONSECUENCIA MEDIDA, que es lo que Santiago vio: con la reversa visible, la suma que la tarjeta hace
  // sobre lo devuelto deja de ser cero para el profesional.
  it("con la reversa visible, su descuento por devoluciones deja de ser cero", async () => {
    await comoUsuario(profesionalUserId, async (tx) => {
      const [suma] = await tx`
        select coalesce(sum(debited_amount), 0)::text as total
          from public.sale_reversals where state = 'devuelta'`;
      expect(Number(suma.total)).toBeGreaterThan(0);
    });
  });
});
