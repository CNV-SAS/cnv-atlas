import Link from "next/link";

import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata = { title: "Iniciar sesión - Atlas" };

// Mensajes de exito que llegan por query param tras una accion que redirige aqui (no son errores).
const MENSAJES: Record<string, string> = {
  clave_lista: "Tu contraseña quedó lista. Entra con ella para continuar.",
};

// Errores que llegan por ?error=. El mensaje dice QUE HACER, no solo que fallo, y distingue quien lo
// resuelve: una invitacion vencida la re-hace el ADMIN (no hay self-service); una recuperacion vencida
// la resuelve el USUARIO en /forgot-password. Sin tipo (enlace_invalido), se cubren los dos casos.
function errorAviso(
  error: string | undefined,
  tipo: string | undefined,
): { texto: string; forgotLink: boolean } | null {
  if (!error) return null;
  if (error === "enlace_expirado" && tipo === "recovery") {
    return { texto: "El enlace para cambiar tu contraseña venció. Solicita uno nuevo.", forgotLink: true };
  }
  if (error === "enlace_expirado" && tipo === "invite") {
    return {
      texto: "Tu invitación venció. Pídele al administrador que te invite de nuevo.",
      forgotLink: false,
    };
  }
  if (error === "enlace_expirado" || error === "enlace_invalido") {
    return {
      texto:
        "El enlace no es válido o venció. Si era una invitación, pide al administrador que te invite de nuevo; si querías cambiar tu contraseña, solicita un enlace nuevo.",
      forgotLink: true,
    };
  }
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mensaje?: string; error?: string; tipo?: string }>;
}) {
  const { mensaje, error, tipo } = await searchParams;
  const aviso = mensaje ? MENSAJES[mensaje] : null;
  const errAviso = errorAviso(error, tipo);

  return (
    <>
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      {aviso ? (
        <p role="status" className="text-sm text-green-700">
          {aviso}
        </p>
      ) : null}
      {errAviso ? (
        <div role="alert" className="flex flex-col gap-1 text-sm text-red-600">
          <p>{errAviso.texto}</p>
          {errAviso.forgotLink ? (
            <Link href="/forgot-password" className="underline underline-offset-4">
              Solicitar un enlace nuevo
            </Link>
          ) : null}
        </div>
      ) : null}
      <LoginForm />
    </>
  );
}
