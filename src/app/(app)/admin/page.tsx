import Link from "next/link";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROFESSION_LABELS } from "@/modules/auth/admin-validations";
import { CreateUserForm } from "@/modules/auth/components/create-user-form";
import { UserRowActions } from "@/modules/auth/components/user-row-actions";
import { MarcaDeAvisos } from "@/modules/avisos/components/marca-de-avisos";
import { listarUsuariosInternosConMarcas } from "@/modules/avisos/data/avisos-repository";
import { ResolverPropuestas } from "@/modules/patients/components/propuestas-de-prueba";
import { propuestasDePruebaPendientes } from "@/modules/patients/data/de-prueba-writer";
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
  // `id` va en el select para poder enlazar a su operacion: la pantalla de /admin/integrantes/[id] se
  // identifica por professional_profiles.id, que es la llave con la que el inventario, las ventas y las
  // comisiones apuntan al integrante (no por profile_id).
  const { data: profRows } = await supabase
    .from("professional_profiles")
    .select("id, profile_id, profession, license");
  const byProfile = new Map((profRows ?? []).map((p) => [p.profile_id, p]));
  const internos = await listarUsuariosInternosConMarcas();
  const propuestasDePrueba = await propuestasDePruebaPendientes();

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
              {/* Su operación: inventario, ventas y comisión. Solo para quien es integrante, porque es lo que
                  ahí se mira; un usuario interno sin perfil profesional no tiene nada que mostrar. */}
              {prof ? (
                <Link
                  href={`/admin/integrantes/${prof.id}`}
                  className="text-sm underline underline-offset-4"
                >
                  Ver su inventario, sus ventas y su comisión
                </Link>
              ) : null}
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
      {/* ═══ QUIEN RECIBE LOS AVISOS DE VENTAS (Bloque A) ═══ Solo usuarios internos: admin, direccion o soporte. */}
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">Avisos de ventas</h2>
        <p className="text-sm text-muted-foreground">
          Quien tiene <strong>Pendientes de ventas</strong> recibe el correo de las 7 a. m. y las 5 p. m. cuando algo
          necesita acción. Quien tiene <strong>Escalamiento</strong> recibe además lo vencido.
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {internos.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
              <span className="min-w-[14rem] flex-1">
                {u.nombre} <span className="text-muted-foreground">({u.roles.join(", ")})</span>
              </span>
              <MarcaDeAvisos profileId={u.id} tipo="pendientes_ventas" activa={u.marcas.includes("pendientes_ventas")} />
              <MarcaDeAvisos profileId={u.id} tipo="escalamiento_ventas" activa={u.marcas.includes("escalamiento_ventas")} />
            </li>
          ))}
        </ul>
        {internos.every((u) => !u.marcas.includes("pendientes_ventas")) ? (
          <p className="text-sm text-destructive">Nadie recibe los pendientes de ventas.</p>
        ) : null}
      </section>
      {/* ═══ PACIENTES PROPUESTOS COMO DE PRUEBA (0180) ═══
          VA AQUI PORQUE SI NO, UNA PROPUESTA NO LA VE NADIE: el profesional la manda y se queda esperando a un
          administrador que no tiene donde mirarla. Es el patron de la "pieza terminada sin el ultimo cable",
          que ya nos paso varias veces.
          Y SOLO APARECE CUANDO HAY ALGO: una seccion vacia permanente entrena a no mirarla. */}
      {propuestasDePrueba.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">Pacientes propuestos como de prueba</h2>
          <p className="text-sm text-muted-foreground">
            Marcarlo lo saca de las cifras y de la facturación, y lo deja visible en la lista del profesional
            para que pueda seguir trabajando con él. Mientras no lo confirmes, sigue contando como cualquier
            otro paciente.
          </p>
          <ResolverPropuestas propuestas={propuestasDePrueba} />
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">Crear usuario</h2>
        <CreateUserForm />
      </section>
    </div>
  );
}
