import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ LOS AVISOS CONTRA LA BASE REAL (Bloque A) ═══
//
// Lo que se protege vive en la base: el trigger que limita la marca a roles internos, el reclamo de un dia y una
// franja (un resumen no sale dos veces), el "en gestion" vigente, y el aviso al Integrante una sola vez. El correo
// se simula: lo que se prueba es a quien y cuantas veces, no Resend.

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
const enviados: { to: string[]; subject: string; text: string }[] = [];
vi.mock("@/lib/email/resend", () => ({
  sendAvisoEmail: vi.fn(async (to: string[], subject: string, text: string) => {
    enviados.push({ to, subject, text });
    return { ok: true, value: { id: "x" } };
  }),
}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

// Fechas de un futuro lejano: cada corrida del test tiene sus propias franjas y no choca con las anteriores.
const DIA = `20${90 + Math.floor(Math.random() * 9)}-0${1 + Math.floor(Math.random() * 8)}-1${Math.floor(Math.random() * 9)}`;
const AM = new Date(`${DIA}T12:00:00Z`);
const PM = new Date(`${DIA}T22:00:00Z`);

let interno = "";
let profesionalSolo = "";
const PROF = "33333333-3333-3333-3333-333333333333";

describe.skipIf(!HAS_DB)("los avisos (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [i] = await db.execute<{ id: string }>(dsql`
      select pr.id from profiles pr join user_roles ur on ur.user_id = pr.id join roles r on r.id = ur.role_id
       where r.name::text = 'admin' and pr.status = 'active' limit 1`);
    interno = i.id;
    const [p] = await db.execute<{ id: string }>(dsql`
      select pr.id from profiles pr
       where exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = pr.id and r.name::text = 'professional')
         and not exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = pr.id and r.name::text in ('admin','direccion','soporte'))
       limit 1`);
    profesionalSolo = p.id;
    await db.execute(dsql`delete from notification_subscriptions where profile_id = ${interno}`);
  });

  afterAll(async () => {
    const { db } = await import("@/db");
    await db.execute(dsql`delete from notification_subscriptions where profile_id = ${interno}`);
  });

  it("la marca solo se pone a admin, direccion o soporte: la base lo impide para un profesional", async () => {
    const { ponerMarca, tieneMarca } = await import("@/modules/avisos/data/avisos-repository");
    await expect(ponerMarca(profesionalSolo, "pendientes_ventas", interno)).rejects.toThrow();
    await ponerMarca(interno, "pendientes_ventas", interno);
    expect(await tieneMarca(interno, "pendientes_ventas")).toBe(true);
  });

  it("un dia y una franja se envian UNA vez, y lo registrado sirve para medir lo nuevo", async () => {
    const { enviarResumen } = await import("@/modules/avisos/services/avisos-service");
    const { db } = await import("@/db");
    // Una venta sin documento garantizada, para que haya algo que avisar.
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    const id = randomUUID();
    await db.execute(dsql`
      insert into transactions (id, organization_id, status, amount, currency, wompi_env, idempotency_key, alegra_invoice_state)
      values (${id}, ${org.id}, 'paid', 11900, 'COP', 'test', ${`aviso-${id}`}, 'pendiente')`);
    try {
      enviados.length = 0;
      const primero = await enviarResumen("am", AM);
      expect(primero.estado).toBe("enviado");
      expect(enviados).toHaveLength(1);
      expect(enviados[0].subject).toContain("Atlas · ventas por resolver");

      const segundo = await enviarResumen("am", AM);
      expect(segundo.estado, "el mismo resumen salio dos veces").toBe("ya_enviado");
      expect(enviados).toHaveLength(1);

      // La TARDE del mismo dia: lo de la manana ya se aviso, y lo sin documento no es de hoy (es de "ahora", no
      // del dia simulado), asi que no hay nada que la dispare.
      const tarde = await enviarResumen("pm", PM);
      expect(tarde.estado).toBe("sin_envio");
      const [run] = await db.execute<{ claves: number }>(dsql`
        select coalesce(array_length(item_keys, 1), 0) as claves from alert_digest_runs where run_date = ${DIA}::date and slot = 'am'`);
      expect(Number(run.claves)).toBeGreaterThan(0);
    } finally {
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
  });

  it("EN GESTION: la ultima marca de gestion es la vigente y aparece en lo pendiente", async () => {
    const { registrarEnGestion, listarPendientesDeAccion } = await import("@/modules/avisos/data/avisos-repository");
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    const id = randomUUID();
    await db.execute(dsql`
      insert into transactions (id, organization_id, status, amount, currency, wompi_env, idempotency_key, alegra_invoice_state)
      values (${id}, ${org.id}, 'paid', 11900, 'COP', 'test', ${`gestion-${id}`}, 'pendiente')`);
    try {
      await registrarEnGestion({ tipo: "sin_documento", transactionId: id, nota: "Primera mirada", hasta: "2099-01-01", actorId: interno });
      await registrarEnGestion({ tipo: "sin_documento", transactionId: id, nota: "Esperando a contabilidad", hasta: "2099-02-01", actorId: interno });
      const p = (await listarPendientesDeAccion()).find((x) => x.transactionId === id);
      expect(p).toMatchObject({ tipo: "sin_documento", enGestionHasta: "2099-02-01", enGestionNota: "Esperando a contabilidad" });
      // Una nota vacia no es una gestion.
      await expect(
        registrarEnGestion({ tipo: "sin_documento", transactionId: id, nota: "  ", hasta: "2099-03-01", actorId: interno }),
      ).rejects.toThrow();
    } finally {
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
  });

  it("el aviso al Integrante sale UNA vez, a su correo, sin datos del paciente", async () => {
    const { avisarAlIntegranteDeRevision } = await import("@/modules/avisos/services/avisos-service");
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    const [pac] = await db.execute<{ id: string; documento: string }>(dsql`select id, document_number as documento from patients limit 1`);
    const [email] = await db.execute<{ email: string }>(dsql`
      select pr.email from professional_profiles pp join profiles pr on pr.id = pp.profile_id where pp.id = ${PROF}`);
    const id = randomUUID();
    await db.execute(dsql`
      insert into transactions (id, organization_id, patient_id, professional_id, status, amount, currency, wompi_env,
                                idempotency_key, review_reason, review_opened_at)
      values (${id}, ${org.id}, ${pac.id}, ${PROF}, 'paid', 11900, 'COP', 'test', ${`integrante-${id}`},
              'pago_sobre_link_anulado', now())`);
    try {
      enviados.length = 0;
      await avisarAlIntegranteDeRevision(id);
      await avisarAlIntegranteDeRevision(id);
      expect(enviados, "el aviso al Integrante salio dos veces").toHaveLength(1);
      expect(enviados[0].to).toEqual([email.email]);
      expect(enviados[0].text).toContain("Cuéntale a CNV qué pasó en la consulta");
      expect(enviados[0].text).not.toContain(pac.documento);
    } finally {
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
  });
});
