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
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Inteligencia artificial
        </h1>
        <p className="text-muted-foreground">
          Proveedor y modelo con los que se genera el menu de apoyo. Las claves de API viven
          solo en el entorno; aqui eliges cual esta activo. El diagnostico nunca usa IA.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Proveedor y modelo</h2>
        <AiConfigForm view={view} />
        {view.current ? (
          <p className="text-xs text-muted-foreground">
            Activo: {view.current.activeProvider} / {view.current.activeModel}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sin configuracion en base de datos: hoy se usa el proveedor definido en el entorno.
          </p>
        )}
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
