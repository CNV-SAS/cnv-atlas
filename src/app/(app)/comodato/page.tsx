import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManageComodato } from "@/modules/comodato/policies/can-manage-comodato";
import { canViewComodato } from "@/modules/comodato/policies/can-view-comodato";
import { AssignComodatoForm } from "@/modules/comodato/components/assign-comodato-form";
import { CreateDeviceForm } from "@/modules/comodato/components/create-device-form";
import { DeviceStatusForm } from "@/modules/comodato/components/device-status-form";
import { ReturnComodatoForm } from "@/modules/comodato/components/return-comodato-form";
import {
  AssignmentStatusBadge,
  DeviceStatusBadge,
} from "@/modules/comodato/components/status-meta";
import * as service from "@/modules/comodato/services/comodato-service";
import type { DeviceAssignment } from "@/modules/comodato/types";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "Comodato - Atlas" };

function isActive(a: DeviceAssignment): boolean {
  return a.status === "active" && a.actual_return_date === null;
}

// Inventario de equipos y comodatos. Lectura admin/soporte (policy + RLS); la
// gestion (crear, asignar, estado, devolver) es admin.
export default async function ComodatoPage() {
  const user = await requireUser();
  if (!canViewComodato(user)) redirect("/no-autorizado");
  const isManager = canManageComodato(user);

  const [devices, assignments, expiring, professionals] = await Promise.all([
    service.listDevices(),
    service.listAssignments(),
    service.listExpiringComodatos(30),
    service.listAssignableProfessionals(),
  ]);

  const proById = new Map(professionals.map((p) => [p.id, p]));
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const assignmentsByDevice = new Map<string, DeviceAssignment[]>();
  for (const a of assignments) {
    const list = assignmentsByDevice.get(a.device_id) ?? [];
    list.push(a);
    assignmentsByDevice.set(a.device_id, list);
  }

  const proName = (id: string) => proById.get(id)?.fullName ?? "(profesional no visible)";

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Comodato</h1>
        <p className="text-muted-foreground">
          Inventario de equipos BIS y sus contratos de comodato.
        </p>
      </header>

      {/* Por vencer en 30 dias */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Vencen en 30 dias</h2>
        {expiring.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay comodatos por vencer en los proximos 30 dias.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expiring.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-clinical-warning/40 bg-clinical-warning-bg px-4 py-3 text-sm"
              >
                <span>
                  <strong>{deviceById.get(a.device_id)?.asset_code ?? a.device_id}</strong> con{" "}
                  {proName(a.professional_id)}
                </span>
                <span className="text-muted-foreground">Vence el {a.expected_end_date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Equipos + historial por equipo */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Equipos</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay equipos registrados.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {devices.map((d) => {
              const history = assignmentsByDevice.get(d.id) ?? [];
              return (
                <Card key={d.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <CardTitle className="text-lg">{d.asset_code}</CardTitle>
                        <CardDescription>
                          {d.model}
                          {d.brand ? `, ${d.brand}` : ""} · {d.system_email}
                        </CardDescription>
                      </div>
                      <DeviceStatusBadge status={d.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {isManager ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Estado del equipo
                        </span>
                        <DeviceStatusForm deviceId={d.id} currentStatus={d.status} />
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Historial de comodato
                      </span>
                      {history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin asignaciones.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {history.map((a) => (
                            <li
                              key={a.id}
                              className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>{proName(a.professional_id)}</span>
                                <AssignmentStatusBadge status={a.status} />
                              </div>
                              <div className="text-muted-foreground">
                                {a.start_date} a {a.expected_end_date}
                                {a.actual_return_date
                                  ? ` · devuelto el ${a.actual_return_date}`
                                  : ""}
                              </div>
                              {isManager && isActive(a) ? (
                                <ReturnComodatoForm assignmentId={a.id} />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Gestion (solo admin) */}
      {isManager ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Crear equipo</CardTitle>
              <CardDescription>Registra un nuevo equipo BIS en el inventario.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateDeviceForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asignar comodato</CardTitle>
              <CardDescription>Asigna un equipo a un profesional.</CardDescription>
            </CardHeader>
            <CardContent>
              <AssignComodatoForm devices={devices} professionals={professionals} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
