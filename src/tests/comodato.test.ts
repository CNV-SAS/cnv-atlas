import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Test de integracion del comodato contra el stack local. Las escrituras pasan
// por un cliente autenticado COMO ADMIN (respeta RLS: solo admin escribe
// devices/device_assignments). La verificacion y limpieza usan la conexion sql
// directa. La regla de doble comodato (conflict) se prueba en el servicio aparte
// (comodato-service.test.ts): a nivel DB no hay constraint, la enforce el servicio.

if (!process.env.DATABASE_URL) process.loadEnvFile?.(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ORG = "11111111-1111-1111-1111-111111111111";
const ASSET = "TEST-CMD-0001";

const admin = createClient(URL, ANON, { auth: { persistSession: false } });
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

let professionalId: string;

async function cleanup() {
  // Borra primero las asignaciones (FK RESTRICT) y luego el equipo de prueba.
  await sql`delete from public.device_assignments a
            using public.devices d
            where a.device_id = d.id and d.asset_code = ${ASSET}`;
  await sql`delete from public.devices where asset_code = ${ASSET}`;
}

beforeAll(async () => {
  const { error } = await admin.auth.signInWithPassword({
    email: "sau.idk001@gmail.com",
    password: process.env.SEED_ADMIN_PASSWORD!,
  });
  if (error) throw error;

  const pro = await sql`select id from public.professional_profiles limit 1`;
  if (pro.length === 0) throw new Error("El seed no tiene professional_profiles.");
  professionalId = pro[0].id as string;

  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await sql.end();
});

describe("B4: comodato e inventario (integracion)", () => {
  it("crea equipo, asigna, no toca el estado del equipo, lista por-vencer e historial", async () => {
    // 1) Crear equipo (admin, via RLS). Estado por defecto: available.
    const { data: device, error: devError } = await admin
      .from("devices")
      .insert({
        organization_id: ORG,
        asset_code: ASSET,
        manufacturer_serial: `${ASSET}-SERIAL`,
        system_email: `${ASSET.toLowerCase()}@cnvsystem.com`,
        model: "Biody B.I.S ZM",
      })
      .select("*")
      .single();
    expect(devError).toBeNull();
    expect(device!.status).toBe("available");

    // 2) Asignar comodato (fin dentro de 20 dias, para que entre en por-vencer).
    const { data: assignment, error: asgError } = await admin
      .from("device_assignments")
      .insert({
        device_id: device!.id,
        professional_id: professionalId,
        start_date: isoOffset(0),
        expected_end_date: isoOffset(20),
      })
      .select("*")
      .single();
    expect(asgError).toBeNull();
    expect(assignment!.status).toBe("active");
    expect(assignment!.actual_return_date).toBeNull();

    // 3) El estado del equipo NO cambio al asignar (equipo y contrato separados).
    const { data: reread } = await admin
      .from("devices")
      .select("status")
      .eq("id", device!.id)
      .single();
    expect(reread!.status).toBe("available");

    // 4) Por vencer en 30 dias: el comodato aparece (mismo filtro del repo).
    const cutoff30 = isoOffset(30);
    const { data: expiring } = await admin
      .from("device_assignments")
      .select("id")
      .eq("status", "active")
      .is("actual_return_date", null)
      .lte("expected_end_date", cutoff30);
    expect(expiring!.some((a) => a.id === assignment!.id)).toBe(true);

    // ...y con un corte de hoy NO aparece (vence en 20 dias): el filtro de fecha sirve.
    const { data: notYet } = await admin
      .from("device_assignments")
      .select("id")
      .eq("status", "active")
      .is("actual_return_date", null)
      .lte("expected_end_date", isoOffset(0));
    expect(notYet!.some((a) => a.id === assignment!.id)).toBe(false);

    // 5) Historial por equipo: contiene la asignacion.
    const { data: history } = await admin
      .from("device_assignments")
      .select("id, professional_id, status")
      .eq("device_id", device!.id)
      .order("start_date", { ascending: false });
    expect(history!.length).toBe(1);
    expect(history![0].professional_id).toBe(professionalId);
  }, 30000);
});
