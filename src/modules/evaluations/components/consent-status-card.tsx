import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { ConsentStatus } from "../data/consent-status-reader";

// Estado del consentimiento del paciente (pestana Evaluacion): "firmado + fecha + version". Es la
// puerta de entrada: si las 3 necesarias no estan vigentes, no debio crearse la evaluacion (regla
// dura 15). Solo display; no firma ni revoca. El color de riesgo va solo en el veredicto (BRAND).

const LABEL: Record<string, string> = {
  servicio: "Tratamiento de datos para el servicio",
  datos_sensibles: "Datos sensibles de salud",
  internacional_ia: "Tratamiento internacional y sistemas automatizados",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "sin fecha";
  return new Date(iso).toLocaleDateString("es-CO");
}

export function ConsentStatusCard({ status }: { status: ConsentStatus }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Consentimiento</CardTitle>
        {status.allNecessaryActive ? (
          <Badge className="bg-clinical-optimal-bg text-clinical-optimal">Firmado</Badge>
        ) : (
          <Badge className="bg-clinical-warning-bg text-clinical-warning">Incompleto</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1.5 text-sm">
          {status.necessary.map((n) => (
            <li key={n.type} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-foreground">{LABEL[n.type] ?? n.type}</span>
              <span className="text-muted-foreground">
                {n.active
                  ? `Firmado el ${fmtDate(n.signedAt)}${n.version ? ` · v${n.version}` : ""}`
                  : "Revocado o sin firmar"}
              </span>
            </li>
          ))}
        </ul>
        {status.representative ? (
          <p className="text-sm text-muted-foreground">
            Firmado por el representante legal
            {status.representative.name ? `: ${status.representative.name}` : ""}
            {status.representative.relationship ? ` (${status.representative.relationship})` : ""}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
