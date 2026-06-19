import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "Tablero - Atlas" };

// Landing del shell. El cierre de sesion vive en el header (avatar). El
// contenido real del tablero llega en bloques posteriores.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Hola, {user.fullName}
      </h1>
      <p className="text-muted-foreground">
        Este es tu tablero de Atlas. Las secciones disponibles dependen de tu rol.
      </p>
    </div>
  );
}
