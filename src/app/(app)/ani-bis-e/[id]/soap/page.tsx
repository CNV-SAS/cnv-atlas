import { notFound, redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { VolverA } from "@/components/shared/volver-a";
import { formatDate } from "@/lib/format/date";
import { requireUser } from "@/modules/auth/session";
import { HistoriaClinicaSoapDoc } from "@/modules/reports/components/hc-soap";
import { getHistoriaClinicaSoap } from "@/modules/reports/data/hc-soap-reader";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";

export const metadata = { title: "Historia clínica (SOAP) - Atlas" };

// ═══ LA HISTORIA CLINICA EN SOAP, EN SU PROPIA PANTALLA (2026-09-20) ═══
//
// POR QUE UNA PANTALLA APARTE Y NO UN BLOQUE MAS en la pestaña de Reporte/HC, que es donde vive la
// historia:
//
//   1. ES OTRO DOCUMENTO, no otra sección del mismo. Reordenar la historia de Gildardo sería cambiar un
//      documento clínico suyo; esto convive con ella y no la toca.
//   2. Y LA PAGINA DE LA EVALUACION YA ES LA MAS PESADA de la aplicación. Componer el SOAP exige releer
//      la historia entera, y colgarlo ahí sumaría ese trabajo a CADA visita de la evaluación, la mire
//      quien la mire. Aquí lo paga solo quien lo pide. La lección es del 504 de /pagos: lo que se suma a
//      una página cargada no se nota hasta que la tumba.
//
// LA POLICY ES LA MISMA que la de la historia clínica (`canManageReports`): es el mismo documento, con
// otro orden. Y el alcance fino lo pone la RLS de los lectores: una evaluación ajena no existe para ellos.
export default async function SoapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const soap = await getHistoriaClinicaSoap(id);
  // Sin historia no hay SOAP: es el mismo dato en otro orden. Pasa cuando la evaluación no es suya (la
  // RLS no la alcanza) o cuando todavía no tiene diagnóstico, y para quien llama las dos son lo mismo.
  if (!soap) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-4">
      <div className="no-print flex flex-col gap-4">
        <VolverA href={`/ani-bis-e/${id}`}>Volver a la evaluación</VolverA>
        <TituloPantalla
          titulo="Historia clínica en formato SOAP"
          descripcion="Los mismos datos de la historia clínica, ordenados por acto clínico: lo que el paciente refiere, lo que se mide, lo que concluyes y lo que se va a hacer."
        />
      </div>

      <HistoriaClinicaSoapDoc soap={soap} fecha={formatDate(soap.fechaConsulta)} />
    </div>
  );
}
