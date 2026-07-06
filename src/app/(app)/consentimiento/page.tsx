import { requireUser } from "@/modules/auth/session";
import { ConsentDocument } from "@/modules/consent/components/consent-document";
import { CONSENT_TEXT_V1_5, CONSENT_VERSION } from "@/modules/consent/text/consent-v1.5";

export const metadata = { title: "Consentimiento vigente - Atlas" };

// Pagina de solo lectura del consentimiento vigente (DELTA2 C1). Requiere sesion
// (cualquier rol autenticado); no lleva policy especial. Sin casillas ni formulario:
// el proposito es consultar en cualquier momento que texto esta vigente.
export default async function ConsentimientoPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Consentimiento informado
        </h1>
        <p className="text-muted-foreground">
          Texto vigente que se presenta a los pacientes antes de la encuesta. Version{" "}
          {CONSENT_VERSION}. Solo lectura.
        </p>
      </header>

      <ConsentDocument text={CONSENT_TEXT_V1_5} />
    </div>
  );
}
