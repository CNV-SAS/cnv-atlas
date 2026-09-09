import Image from "next/image";

import { CONSENT_TEXT_V1_0 } from "@/modules/consent/text/consent-v1.0";
import { ConsentimientoQr } from "@/modules/consent/components/consentimiento-qr";
import { resolverSesionPorToken } from "@/modules/consent/data/sesion-presencial";
import { getProfessionalForConsent } from "@/modules/evaluations/data/survey-links-reader";

export const metadata = { title: "Autorización - Atlas" };

// LA PAGINA DEL PACIENTE · MODALIDAD 2 (QR). Superficie PUBLICA: se abre en el telefono del paciente, sin
// sesion, autenticada solo por el token que vio en la pantalla del profesional.
//
// LA PAGINA NO SELLA NADA. Un componente de servidor se re-renderiza, y la marca de apertura tiene que
// significar "cuando el paciente lo abrio", una sola vez. Aqui solo se LEE; el sello lo hace el cliente al
// montarse.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-start justify-center bg-muted/30 px-4 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2 self-start">
          <Image
            src="/brand/logo-horizontal.svg"
            alt="Atlas"
            width={140}
            height={28}
            priority
            unoptimized
            className="h-7 w-auto"
          />
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function ConsentimientoQrPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sesion = await resolverSesionPorToken(token);

  // TRES SITUACIONES DISTINTAS Y UN SOLO MENSAJE, a proposito: que el codigo no exista, que ya se usara o
  // que venciera son cosas distintas para nosotros y la misma para el paciente, que solo puede hacer una
  // cosa (pedirle otro a su profesional). Distinguirlas en pantalla contaria de mas sin ayudarle.
  if (!sesion || !sesion.vigente) {
    return (
      <Shell>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Este código ya no está disponible
          </h1>
          <p className="text-sm text-muted-foreground">
            Puede que ya se haya usado o que haya pasado demasiado tiempo. Pídele a tu profesional que te
            muestre uno nuevo; toma un segundo.
          </p>
        </div>
      </Shell>
    );
  }

  const profesional = (await getProfessionalForConsent(sesion.professionalId)) ?? {
    fullName: "",
    profession: "",
    license: null,
  };

  return (
    <Shell>
      {/* EL TONO. La intencion se conserva (invitar a leer sin prisa es correcto y es lo que hace INFORMADO
          al consentimiento), pero la redaccion es la de un documento legal y no la de un mensaje de
          aplicacion: "tienes tiempo de sobra y nadie te esta esperando" sonaba a conversacion.
          Se dice lo mismo con la forma que corresponde: que es una decision suya, que el tiempo esta
          previsto, y que puede preguntar. */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Autorización de tratamiento de datos
        </h1>
        <p className="text-sm text-muted-foreground">
          {profesional.fullName ? `Consulta con ${profesional.fullName}. ` : ""}
          Lee el documento completo antes de autorizar. Dispones del tiempo que necesites, y puedes
          preguntarle a tu profesional cualquier punto que no te quede claro.
        </p>
      </div>
      <ConsentimientoQr token={token} consentText={CONSENT_TEXT_V1_0} />
    </Shell>
  );
}
