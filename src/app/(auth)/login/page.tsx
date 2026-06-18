import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata = { title: "Iniciar sesion - Atlas" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Iniciar sesion</h1>
      <LoginForm />
    </>
  );
}
