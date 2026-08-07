import { MfaChallengeForm } from "@/modules/auth/components/mfa-challenge-form";

export const metadata = { title: "Verificación en dos pasos - Atlas" };

export default function MfaChallengePage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Verificación en dos pasos</h1>
      <p>Ingresa el código de tu app de autenticación.</p>
      <MfaChallengeForm />
    </>
  );
}
