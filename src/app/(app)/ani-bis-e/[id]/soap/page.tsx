import { notFound, redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { VolverA } from "@/components/shared/volver-a";
import { formatDate } from "@/lib/format/date";
import { requireUser } from "@/modules/auth/session";
import { HistoriaClinicaSoapDoc } from "@/modules/reports/components/hc-soap";
import { getHistoriaClinicaSoap } from "@/modules/reports/data/hc-soap-reader";
import { notasSubjetivasEnOrden } from "@/modules/reports/data/soap-notas-writer";
import { getActorProfession } from "@/modules/treatment/data/actor-profession-reader";
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

  const actorProfession = await getActorProfession(user.id);
  const [soap, notas] = await Promise.all([
    getHistoriaClinicaSoap(id),
    // LA ANAMNESIS DEL PROFESIONAL (apartado S). En paralelo: son dos consultas independientes y esta
    // pantalla ya paga la composicion de la historia entera.
    notasSubjetivasEnOrden(id),
  ]);
  // Sin historia no hay SOAP: es el mismo dato en otro orden. Pasa cuando la evaluación no es suya (la
  // RLS no la alcanza) o cuando todavía no tiene diagnóstico, y para quien llama las dos son lo mismo.
  if (!soap) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-4">
      <div className="no-print flex flex-col gap-4">
        {/* EL PADRE ES LA PESTAÑA, no la evaluacion "en general" (Santiago, 2026-09-20): a esta pantalla
            se llega desde el bloque de la historia clinica, y devolver al conjunto obliga a buscar otra
            vez la pestaña. Este fue el caso que destapo la observacion (b); ahora el rotulo lo pone el
            destino y, si alguien llega desde otro sitio, ese otro sitio gana. */}
        <VolverA padre={`/ani-bis-e/${id}?etapa=reporte`} />
        <TituloPantalla
          titulo="Historia clínica en formato SOAP"
          descripcion="Los mismos datos de la historia clínica, ordenados por acto clínico: lo que el paciente refiere, lo que se mide, lo que concluyes y lo que se va a hacer."
        />
      </div>

      <HistoriaClinicaSoapDoc
        soap={soap}
        fecha={formatDate(soap.fechaConsulta)}
        evaluationId={id}
        notasSubjetivas={notas.map((n) => ({
          id: n.id,
          texto: n.texto,
          autor: n.autor,
          profesion: n.profesion,
          fecha: formatDate(n.creadaEn),
        }))}
        // ESCRIBIR ES UN ACTO CLINICO: lo hace quien atiende, no quien administra. El admin puede LEER
        // la historia (su policy se lo permite) y aqui no escribe, igual que no escribe las demas notas.
        puedeEscribir={actorProfession.isProfessional}
      />
    </div>
  );
}
