import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata = { title: "Iniciar sesión - Atlas" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      <LoginForm />
    </>
  );
}
