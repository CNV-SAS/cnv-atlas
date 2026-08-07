import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata = { title: "Iniciar sesión - Atlas" };

// Mensajes de exito que llegan por query param tras una accion que redirige aqui (no son errores).
const MENSAJES: Record<string, string> = {
  clave_lista: "Tu contraseña quedó lista. Entra con ella para continuar.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mensaje?: string }>;
}) {
  const { mensaje } = await searchParams;
  const aviso = mensaje ? MENSAJES[mensaje] : null;

  return (
    <>
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      {aviso ? (
        <p role="status" className="text-sm text-green-700">
          {aviso}
        </p>
      ) : null}
      <LoginForm />
    </>
  );
}
