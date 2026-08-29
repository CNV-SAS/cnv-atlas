import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROFESSION_LABELS } from "@/modules/auth/admin-validations";
import { CreateUserForm } from "@/modules/auth/components/create-user-form";
import { UserRowActions } from "@/modules/auth/components/user-row-actions";
import { canAccessAdmin } from "@/modules/auth/policies/can-access-admin";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "Administración - Atlas" };

// UI minima (B2). El shell con marca es B3. La autorizacion de ruta va por policy
// (regla 3): sin permiso, a /no-autorizado.
export default async function AdminPage() {
  const user = await requireUser();
  if (!canAccessAdmin(user)) {
    redirect("/no-autorizado");
  }

  // Lectura bajo RLS: solo admin ve a todos los profiles (policy de B1).
  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, status")
    .order("created_at", { ascending: true });

  // Perfil profesional (profesion + registro) por profile_id. Consulta plana aparte (no embed) para
  // no acoplar el tipo del select. Es la vista donde el registro profesional tiene sentido: un
  // profesional sin registro no puede ejercer, y aqui se ve "sin registro" a simple vista.
  const { data: profRows } = await supabase
    .from("professional_profiles")
    .select("profile_id, profession, license");
  const byProfile = new Map((profRows ?? []).map((p) => [p.profile_id, p]));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* SIN SUBTITULO: no lo tenia, y la lista de abajo ya dice que es. */}
      <TituloPantalla titulo="Usuarios" />
      <ul className="flex flex-col gap-3 text-sm">
        {(users ?? []).map((u) => {
          const prof = byProfile.get(u.id) ?? null;
          const professionLabel = prof
            ? (PROFESSION_LABELS[prof.profession as keyof typeof PROFESSION_LABELS] ?? prof.profession)
            : null;
          return (
            <li key={u.id} className="flex flex-col gap-2 border-b pb-3">
              <span>
                {u.email}, {u.full_name} ({u.status})
                {prof ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {professionLabel} ·{" "}
                    {prof.license ? (
                      `Reg. ${prof.license}`
                    ) : (
                      <span className="text-amber-700">sin registro</span>
                    )}
                  </span>
                ) : null}
              </span>
              {/* Las acciones no se ofrecen sobre la propia cuenta del admin (evita reiniciar su propio acceso por error). */}
              {u.id === user.id ? (
                <span className="text-xs text-muted-foreground">Tu cuenta</span>
              ) : (
                <UserRowActions
                  userId={u.id}
                  email={u.email}
                  isProfessional={Boolean(prof)}
                  license={prof?.license ?? null}
                />
              )}
            </li>
          );
        })}
      </ul>
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">Crear usuario</h2>
        <CreateUserForm />
      </section>
    </div>
  );
}
