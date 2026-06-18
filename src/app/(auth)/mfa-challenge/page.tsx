import { MfaChallengeForm } from "@/modules/auth/components/mfa-challenge-form";

export const metadata = { title: "Verificacion en dos pasos - Atlas" };

export default function MfaChallengePage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Verificacion en dos pasos</h1>
      <p>Ingresa el codigo de tu app de autenticacion.</p>
      <MfaChallengeForm />
    </>
  );
}
