import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { AiConfigForm } from "@/modules/ai-admin/components/ai-config-form";
import { AiPromptForm } from "@/modules/ai-admin/components/ai-prompt-form";
import { getAiConfigView } from "@/modules/ai-admin/data/ai-config-reader";
import { getPromptView } from "@/modules/ai-admin/data/ai-prompt-reader";
import { canManageAi } from "@/modules/ai-admin/policies/can-manage-ai";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "IA - Atlas" };

// Panel admin de IA (B14): proveedor/modelo activos y (ST2) el prompt versionado. La
// autorizacion va por policy (regla 3): sin permiso, a /no-autorizado.
export default async function AdminAiPage() {
  const user = await requireUser();
  if (!canManageAi(user)) {
    redirect("/no-autorizado");
  }

  const [view, promptView] = await Promise.all([
    getAiConfigView(),
    getPromptView("menu.generate"),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {/* SUBTITULO RECORTADO de cinco frases a dos. Caen las que describen la pantalla ("proveedor y
          modelo que usa la aplicacion", "aqui eliges cual esta activo": el formulario de abajo lo
          muestra). Quedan las dos que NO se ven y que alguien podria suponer al reves: que la
          configuracion es GLOBAL y no por funcion, y que el diagnostico nunca usa IA. */}
      <TituloPantalla
        titulo="Inteligencia artificial"
        descripcion="La configuración es global, no por función; lo que sí es por función son los prompts, cada uno con su versión. El diagnóstico nunca usa IA."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Proveedor y modelo</h2>
        {/* El resumen "Activo" vive dentro del form (cliente) para reflejar el guardado al
            instante, sin el lag del round-trip de revalidacion. */}
        <AiConfigForm view={view} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Prompt del menu</h2>
        <p className="text-sm text-muted-foreground">
          Instrucciones con las que la IA genera el menu de apoyo. Cada cambio crea una version
          nueva auditada; la version activa es la que se usa al generar.
        </p>
        <AiPromptForm view={promptView} />
      </section>
    </div>
  );
}
