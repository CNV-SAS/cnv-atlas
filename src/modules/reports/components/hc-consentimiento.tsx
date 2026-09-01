import { formatDate } from "@/lib/format/date";

// SELLO DE CONSENTIMIENTO DE LA HISTORIA CLINICA (asesoria legal, 2026-09-01).
//
// QUE PIDE EL LEGAL: que el documento diga BAJO QUE AUTORIZACIONES se recogio cada cosa. No basta con que
// el consentimiento exista en alguna tabla: la historia clinica es el documento probatorio, y si manana
// alguien pregunta con que permiso se capturo la etnia de un paciente, la respuesta tiene que estar EN el
// documento, no en una consulta que alguien tendria que saber hacer.
//
// POR QUE VA LA VERSION Y NO SOLO EL "SI": las autorizaciones cambian de texto. Un "acepto" de la v1.0 no
// dice lo mismo que uno de una v2 futura, y lo que se pactó fue el texto de SU version. Sin la version, el
// sello afirma que hubo permiso pero no de que.
//
// LA FECHA DE LA EVALUACION va al lado a proposito: `evaluations.consent_version` sella con que version se
// capturo ESTA consulta, que puede no ser la vigente hoy. Las dos juntas dicen "esto se recogio bajo esta
// version, en esta fecha".
//
// LO QUE NO HACE: no es un gate. El gate clinico (regla dura 15) vive en la policy y ya impidio crear la
// evaluacion sin las autorizaciones necesarias. Esto es CONSTANCIA de lo que aquel gate verifico.

export type HcAutorizacion = {
  tipo: string;
  etiqueta: string;
  necesaria: boolean;
  vigente: boolean;
  firmadaEl: string | null;
  version: string | null;
  revocadaEl: string | null;
};

export function HcConsentimiento({
  autorizaciones,
  versionDeLaConsulta,
}: {
  autorizaciones: HcAutorizacion[];
  /** `evaluations.consent_version`: la version bajo la que se capturo ESTA consulta. */
  versionDeLaConsulta: string | null;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
        Autorizaciones bajo las que se recogió esta información
      </h3>
      <p className="text-xs text-muted-foreground">
        Consulta capturada bajo el consentimiento{" "}
        <strong>versión {versionDeLaConsulta ?? "no registrada"}</strong>.
      </p>

      {autorizaciones.length === 0 ? (
        // Un bloque vacio sin explicar, en un documento probatorio, se lee como "no se pidio permiso".
        <p className="text-xs text-muted-foreground">
          No hay autorizaciones registradas para este paciente.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Autorización</th>
              <th className="py-1 pr-3 font-medium">Estado</th>
              <th className="py-1 pr-3 font-medium">Versión</th>
              <th className="py-1 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {autorizaciones.map((a) => (
              <tr key={a.tipo} className="border-b border-border/50">
                <td className="py-1 pr-3">
                  {a.etiqueta}
                  {a.necesaria ? (
                    <span className="ml-1 text-muted-foreground">(necesaria)</span>
                  ) : null}
                </td>
                <td className="py-1 pr-3">
                  {/* REVOCADA no es lo mismo que NUNCA OTORGADA, y en un documento probatorio la
                      diferencia es la que importa: una dice que el permiso existio y se retiro, la otra
                      que nunca lo hubo. Un solo "no" las confundiria. */}
                  {a.revocadaEl
                    ? "Revocada"
                    : a.vigente
                      ? "Vigente"
                      : a.firmadaEl
                        ? "No vigente"
                        : "No otorgada"}
                </td>
                <td className="py-1 pr-3">{a.version ?? "—"}</td>
                <td className="py-1">
                  {a.revocadaEl
                    ? formatDate(a.revocadaEl)
                    : a.firmadaEl
                      ? formatDate(a.firmadaEl)
                      : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
