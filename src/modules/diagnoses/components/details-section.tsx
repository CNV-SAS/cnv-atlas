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
      className="group rounded-xl border border-border bg-card"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-6 py-4 text-lg font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-6 pb-6">{children}</div>
    </details>
  );
}
