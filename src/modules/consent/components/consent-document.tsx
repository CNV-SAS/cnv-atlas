import { Markdown } from "@/components/shared/markdown";

// Render de solo lectura del texto del consentimiento (DELTA2 C1). Delega en el
// renderizador de markdown compartido (mismo estilo que el resto de la app) dentro de su
// caja. react-markdown no interpreta HTML crudo por defecto (SECURITY.md).
export function ConsentDocument({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 sm:p-6">
      <Markdown text={text} />
    </div>
  );
}
