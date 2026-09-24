import { redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { RevisionImportacion } from "@/modules/importacion-html/components/revision-importacion";
import { LotesImportados } from "@/modules/importacion-html/components/lotes-importados";
import { listarLotes, listarProfesionalesParaImportar } from "@/modules/importacion-html/data/contexto-reader";
import { canImportFromHtml } from "@/modules/importacion-html/policies/can-import-from-html";

export const metadata = { title: "Importar del HTML - Atlas" };

// ═══ EL TIEMPO DE LA IMPORTACION (2026-09-24) ═══
//
// MEDIDO, NO ESTIMADO: 160 pacientes con 3 consultas cada uno (el tamaño del primer archivo real) tardan
// ~14 s contra la base LOCAL. Son unas 4.600 idas a la base, y en la nube cada una cuesta mas, así que el
// valor por defecto de Vercel (15 s) lo cortaría a la mitad.
//
// Cortarse a la mitad NO deja medio import: todo va en UNA transacción, así que se deshace entero. Pero el
// admin vería un fallo sin remedio y con un archivo perfectamente bueno. Se declara explícito, como en
// /pagos, para no depender del valor por defecto del proyecto.
export const maxDuration = 300;

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
