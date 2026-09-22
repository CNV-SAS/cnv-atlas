import { redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { RevisionImportacion } from "@/modules/importacion-html/components/revision-importacion";
import { LotesImportados } from "@/modules/importacion-html/components/lotes-importados";
import { listarLotes, listarProfesionalesParaImportar } from "@/modules/importacion-html/data/contexto-reader";
import { canImportFromHtml } from "@/modules/importacion-html/policies/can-import-from-html";

export const metadata = { title: "Importar del HTML - Atlas" };

// LA IMPORTACION DE PACIENTES DEL HTML DE GILDARDO (plan en docs/PLAN_IMPORTACION_DESDE_EL_HTML.md). Solo
// admin. Hoy es la revision (sesion 3), que no escribe nada; la importacion misma llega en la sesion 4.
export default async function ImportarHtmlPage() {
  const user = await requireUser();
  if (!canImportFromHtml(user)) redirect("/no-autorizado");
  const [profesionales, lotes] = await Promise.all([listarProfesionalesParaImportar(), listarLotes()]);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <TituloPantalla
        titulo="Importar pacientes del HTML"
        descripcion="Revisa el archivo que exportó un profesional y, cuando esté bien, impórtalo a la cuenta que elijas. La revisión no guarda nada; la importación queda como un lote que se puede deshacer."
      />
      <RevisionImportacion profesionales={profesionales} />
      <LotesImportados lotes={lotes} />
    </div>
  );
}
