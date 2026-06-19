import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  AssignableProfessional,
  AssignmentStatus,
  Device,
  DeviceAssignment,
  DeviceInsert,
  DeviceStatus,
} from "../types";

// Repositorio del comodato (ARCHITECTURE regla 1). Usa el cliente Supabase
// anon + RLS: las lecturas quedan acotadas por las policies (un profesional solo
// ve sus asignaciones) y las escrituras solo pasan para admin. Drizzle conectaria
// como superusuario y se saltaria RLS, asi que aqui NO se usa.
//
// Las funciones lanzan en error; el service las envuelve en Result.

function fail(context: string, message: string | undefined): never {
  throw new Error(`comodato-repository: ${context}: ${message ?? "error desconocido"}`);
}

// ----- Equipos -----

export async function listDevices(): Promise<Device[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .order("asset_code", { ascending: true });
  if (error) fail("listDevices", error.message);
  return data ?? [];
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("devices").select("*").eq("id", id).maybeSingle();
  if (error) fail("getDeviceById", error.message);
  return data;
}

export async function createDevice(
  values: Omit<DeviceInsert, "organization_id">,
  organizationId: string,
): Promise<Device> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("devices")
    .insert({ ...values, organization_id: organizationId })
    .select("*")
    .single();
  if (error) fail("createDevice", error.message);
  return data!;
}

export async function updateDeviceStatus(id: string, status: DeviceStatus): Promise<Device> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("devices")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail("updateDeviceStatus", error.message);
  return data!;
}

// ----- Profesionales asignables (para el selector) -----

export async function listAssignableProfessionals(): Promise<AssignableProfessional[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("id, profiles ( full_name, email )");
  if (error) fail("listAssignableProfessionals", error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.profiles?.full_name ?? "(sin nombre)",
    email: row.profiles?.email ?? "",
  }));
}

// ----- Asignaciones (comodatos) -----

export async function listAssignments(): Promise<DeviceAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("device_assignments")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) fail("listAssignments", error.message);
  return data ?? [];
}

export async function listAssignmentsByDevice(deviceId: string): Promise<DeviceAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("device_assignments")
    .select("*")
    .eq("device_id", deviceId)
    .order("start_date", { ascending: false });
  if (error) fail("listAssignmentsByDevice", error.message);
  return data ?? [];
}

// Asignacion activa y sin devolver de un equipo (para impedir doble comodato).
export async function getActiveAssignmentForDevice(
  deviceId: string,
): Promise<DeviceAssignment | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("device_assignments")
    .select("*")
    .eq("device_id", deviceId)
    .eq("status", "active")
    .is("actual_return_date", null)
    .maybeSingle();
  if (error) fail("getActiveAssignmentForDevice", error.message);
  return data;
}

export async function createAssignment(values: {
  deviceId: string;
  professionalId: string;
  startDate: string;
  expectedEndDate: string;
}): Promise<DeviceAssignment> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("device_assignments")
    .insert({
      device_id: values.deviceId,
      professional_id: values.professionalId,
      start_date: values.startDate,
      expected_end_date: values.expectedEndDate,
    })
    .select("*")
    .single();
  if (error) fail("createAssignment", error.message);
  return data!;
}

export async function returnAssignment(
  id: string,
  actualReturnDate: string,
  status: AssignmentStatus,
): Promise<DeviceAssignment> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("device_assignments")
    .update({ actual_return_date: actualReturnDate, status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail("returnAssignment", error.message);
  return data!;
}

// Comodatos por vencer: activos, sin devolver, con fin en o antes del corte.
export async function listExpiringAssignments(
  cutoffDate: string,
): Promise<DeviceAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("device_assignments")
    .select("*")
    .eq("status", "active")
    .is("actual_return_date", null)
    .lte("expected_end_date", cutoffDate)
    .order("expected_end_date", { ascending: true });
  if (error) fail("listExpiringAssignments", error.message);
  return data ?? [];
}
