import { type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Seccion colapsable para contenido secundario o de detalle (tablas granulares, analisis de otra
// naturaleza). `<details>` nativo: accesible, sin JS ni dependencia. El marcador nativo se oculta
// y se usa un chevron que rota al abrir (via variante open de Tailwind). Server component puro.
export function DetailsSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      {...(defaultOpen ? { open: true } : {})}
      className="group overflow-hidden rounded-xl border border-border bg-card"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-6 py-4 text-lg font-semibold text-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      {/* Divisor solo visible al abrir (el contenido oculto no muestra el borde). */}
      <div className="border-t border-border px-6 py-6">{children}</div>
    </details>
  );
}
