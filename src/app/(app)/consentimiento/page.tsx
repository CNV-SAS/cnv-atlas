import { requireUser } from "@/modules/auth/session";
import { ConsentDocument } from "@/modules/consent/components/consent-document";
import { buildConsentFullPreview } from "@/modules/consent/consent-instance";
import { CONSENT_TEXT_V1_0, CONSENT_VERSION } from "@/modules/consent/text/consent-v1.0";

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

      {/* Vista COMPLETA de la plantilla vigente: AMBAS ramas (mayor y menor) con los campos como rotulos.
          NO una instancia de un paciente (esa filtra la rama menor). Asi se lee el texto entero, incluido
          el bloque de menores, sin marcadores crudos. */}
      <ConsentDocument text={buildConsentFullPreview(CONSENT_TEXT_V1_0)} />
      <p className="text-xs text-muted-foreground">
        Este es el texto completo de la plantilla vigente. Segun la edad del paciente, en el documento que
        firma se muestra solo la rama que aplica (mayor de edad o representante legal del menor).
      </p>
    </div>
  );
}
