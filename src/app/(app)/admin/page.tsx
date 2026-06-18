import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateUserForm } from "@/modules/auth/components/create-user-form";
import { canAccessAdmin } from "@/modules/auth/policies/can-access-admin";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "Administracion - Atlas" };

// UI minima (B2). El shell con marca y la pagina /no-autorizado dedicada son B3/B6.
export default async function AdminPage() {
  const user = await requireUser();
  if (!canAccessAdmin(user)) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">No autorizado</h1>
      </main>
    );
  }

  // Lectura bajo RLS: solo admin ve a todos los profiles (policy de B1).
  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, status")
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Usuarios</h1>
      <ul className="flex flex-col gap-1">
        {(users ?? []).map((u) => (
          <li key={u.id}>
            {u.email} — {u.full_name} ({u.status})
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Crear usuario</h2>
        <CreateUserForm />
      </section>
    </main>
  );
}
