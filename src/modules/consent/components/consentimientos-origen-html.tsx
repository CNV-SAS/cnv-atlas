import { Panel } from "@/components/shared/panel";
import { formatDateOnly } from "@/lib/format/date";

import type { ConsentimientoDeOrigenHtml } from "../data/consent-reader";

// LA FICHA DEL PACIENTE IMPORTADO LO DICE (plan de la importacion desde el HTML, sesion 1). Componente de
// servidor: solo muestra. Aparece solo si el paciente trae consentimientos del HTML.
//
// EL MENSAJE DEPENDE DE SI YA FIRMO EL DE ATLAS: mientras no, el enlace de seguimiento se lo va a pedir
// (`modoDelSeguimiento`), y eso es lo que el profesional necesita saber antes de mandarlo.
export function ConsentimientosOrigenHtml({
  consentimientos,
  tieneElDeAtlas,
}: {
  consentimientos: ConsentimientoDeOrigenHtml[];
  tieneElDeAtlas: boolean;
}) {
  if (consentimientos.length === 0) return null;
  return (
    <Panel titulo="Consentimiento de origen HTML">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-foreground">
          {tieneElDeAtlas
            ? "Firmó el consentimiento en el HTML y después el de Atlas, que es el vigente."
            : "Consentimiento de origen HTML. Firmará el de Atlas en su próxima consulta: el enlace de seguimiento se lo pedirá con su código de verificación."}
        </p>
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {consentimientos.map((c) => (
            <li key={c.fechaConsulta}>
              Consulta del {formatDateOnly(c.fechaConsulta)} · firmado con el nombre{" "}
              <span className="font-medium text-foreground">{c.nombreTecleado}</span> el {c.fechaRegistrada} ·{" "}
              {c.versionDelTexto}, sin código de verificación
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
