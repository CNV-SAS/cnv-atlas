import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

// Aviso CRITICO de seguridad del paciente (sindrome de realimentacion). Componente NEUTRO (sin "use client" ni
// server-only): lo renderizan el resumen server (profession-treatment-section) y el panel client (treatment-panel).
//
// Se distingue A PROPOSITO de los avisos ambar del plan (desfase, descuadre, sin porciones): borde GRUESO rojo,
// icono de escudo y etiqueta "Seguridad del paciente". No es un aviso mas: es la señal que dice que hay que
// empezar bajo con las kcal. Y NO es descartable: no lleva boton de cierre ni estado; siempre se muestra cuando
// el motor marca el riesgo (alertaSindRealim). Un aviso de seguridad que se puede ocultar deja de proteger.
export function RealimentacionAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border-2 border-clinical-critical bg-clinical-critical-bg p-4"
    >
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-clinical-critical" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-wide text-clinical-critical">
          Seguridad del paciente
        </span>
        <p className="max-w-prose text-sm font-medium leading-relaxed text-foreground">{children}</p>
      </div>
    </div>
  );
}
