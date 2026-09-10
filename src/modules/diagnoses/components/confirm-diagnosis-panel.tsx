import { ShieldCheck } from "lucide-react";

import { formatDateTime } from "@/lib/format/date";

// ═══ EL ACTO DE CONFIRMAR SE RETIRO; EL HECHO SE CONSERVA (Santiago, 2026-09-10) ═══
//
// LO QUE HABIA: un boton en dos pasos, con dialogo, que decia de si mismo que era IRREVERSIBLE y que era
// "lo que habilita prescribir". Se describia como el acto mas peligroso de la aplicacion.
//
// POR QUE SE RETIRA, y son tres cosas, no una:
//
//   1. YA NO HABILITA NADA. Los cinco gates que colgaban de la confirmacion se retiraron (el menu semanal,
//      los nutraceuticos y su decision, el reconocimiento de restricciones y las notas). Se puede
//      prescribir sin confirmar, asi que el texto era FALSO en las tres veces que lo decia.
//   2. Y NO DEBIA HABILITAR NADA (Gildardo via Santiago, 2026-09-09): **el diagnostico es del MODELO, no
//      del profesional.** Nadie firma el resultado del motor; lo que si se firma es haber prescrito sobre
//      el. Es la misma razon por la que se retiro el boton de aprobar la prescripcion.
//   3. UN ACTO IRREVERSIBLE QUE NO CAMBIA NADA ES UNA TRAMPA. Cuesta una decision, avisa de que no se
//      puede deshacer, y no compra nada. Es el tercero de la misma familia que Santiago ha señalado.
//
// LO QUE **NO** SE PIERDE, y es la mitad que importaba: `confirmed_by`, `confirmed_at` y
// `confirmed_profession` SE SIGUEN SELLANDO, en el acto que si existe: al aprobar el reporte
// (`reports-writer.ts`, evento `diagnosis.confirmed_via_report`). O sea que la firma clinica queda
// registrada donde Gildardo dijo que debia quedar, en el momento en que el plan sale hacia el paciente.
// Este bloque pasa a RENDIR ESE HECHO, no a producirlo.
//
// LO QUE CAMBIA Y HAY QUE DECIRLO: quien aprueba el reporte puede ser un admin (su policy lo permite), y
// entonces `confirmed_profession` queda en null. Ya se guardaba asi, honestamente, y no se inventa una
// profesion; pero antes existia la via de que el profesional lo sellara ANTES con la suya. Si eso importa
// clinicamente, la salida no es devolver este boton: es que aprobar el reporte exija profesional.
//
// SIN CONFIRMAR NO SE PINTA NADA. Un bloque que solo dijera "todavia no se ha sellado" seria un reproche
// sobre algo que el profesional no puede hacer directamente, y la lista de pendientes del cierre ya cubre
// lo que si depende de el (aprobar y enviar el reporte).
export function ConfirmDiagnosisPanel({
  confirmed,
  confirmedAt,
  confirmedByName,
}: {
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedByName: string | null;
}) {
  if (!confirmed) return null;

  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-clinical-optimal/40 bg-clinical-optimal-bg p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-clinical-optimal" aria-hidden />
        <h2 className="text-lg font-bold text-clinical-optimal">Diagnóstico confirmado</h2>
      </div>
      <p className="text-sm text-foreground/90">
        Confirmado{confirmedByName ? ` por ${confirmedByName}` : ""}
        {confirmedAt ? ` el ${formatDateTime(confirmedAt)}` : ""}, al aprobar el reporte del paciente. Queda
        registrado con la profesión de quien lo aprobó. Hoy no existe una vía para corregir un diagnóstico
        ya confirmado: si detectas un error, la única opción es crear una evaluación nueva del paciente. La
        medición del equipo se puede volver a importar, así que corregir no exige volver a medir al
        paciente.
      </p>
    </section>
  );
}
