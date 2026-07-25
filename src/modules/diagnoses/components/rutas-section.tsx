import {
  Brain,
  CheckCircle2,
  Dna,
  Dumbbell,
  HeartPulse,
  Hourglass,
  type LucideIcon,
  Salad,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RutaComponent, RutaContent } from "@/clinical-engine/rutas-content";

// Sección 1 del Tratamiento: las rutas de atención ACTIVAS (salida del DFI), con su contenido
// clínico congelado en el snapshot (verbatim de Gildardo, T1). Presentación pura. Fidelidad
// estructural al prototipo: por ruta, activación + los componentes nutricional/ejercicio/psicológico
// (el médico NO va aquí: es siempre remisión, Sección 3) + el bloque de seguimiento. Las indicaciones
// se muestran VERBATIM (contenido clínico de Gildardo), sin resumir ni reordenar.

// Icono lucide por ruta (BRAND, sin emojis). Reemplaza el emoji del prototipo.
const ROUTE_ICON: Record<string, LucideIcon> = {
  R1: Zap,
  R2: HeartPulse,
  R3: Brain,
  R4: Hourglass,
  R5: Dna,
  R6: CheckCircle2,
};
// Acento DECORATIVO por ruta (borde izquierdo). No es severidad clínica; se unifica en el bloque de
// diseño final. Solo diferencia visual de la ruta, como en el prototipo.
const ROUTE_ACCENT: Record<string, string> = {
  R1: "#dc2626",
  R2: "#ea580c",
  R3: "#db2777",
  R4: "#ca8a04",
  R5: "#16a34a",
  R6: "#0d9488",
};

function ComponentBox({
  label,
  Icon,
  indicaciones,
}: {
  label: string;
  Icon: LucideIcon;
  indicaciones: string[];
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {label}
      </span>
      <ul className="list-inside list-disc text-xs text-muted-foreground">
        {indicaciones.map((ind, i) => (
          <li key={i}>{ind}</li>
        ))}
      </ul>
    </div>
  );
}

function RutaCard({ ruta }: { ruta: RutaContent }) {
  const Icon = ROUTE_ICON[ruta.id] ?? Zap;
  const accent = ROUTE_ACCENT[ruta.id] ?? "var(--primary)";
  const { nutricional, ejercicio, psicologico } = ruta.componentes;
  // Sección 1: nutricional y ejercicio salvo aplica===false; psicológico solo si aplica. Médico no.
  const comps: { key: string; label: string; Icon: LucideIcon; comp: RutaComponent }[] = [];
  if (nutricional.aplica !== false)
    comps.push({ key: "nutricional", label: "Nutricional", Icon: Salad, comp: nutricional });
  if (ejercicio.aplica !== false)
    comps.push({ key: "ejercicio", label: "Ejercicio", Icon: Dumbbell, comp: ejercicio });
  if (psicologico.aplica)
    comps.push({ key: "psicologico", label: "Psicológico", Icon: Brain, comp: psicologico });

  return (
    <div
      className="rounded-xl border border-border p-4"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div className="flex items-start gap-2">
        <Icon className="size-5 shrink-0" style={{ color: accent }} aria-hidden />
        <div className="flex flex-col">
          <h4 className="font-semibold text-foreground">
            {ruta.id} · {ruta.label}
          </h4>
          <p className="text-xs text-muted-foreground">Activación: {ruta.activacion}</p>
        </div>
      </div>

      {comps.length ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {comps.map((c) => (
            <ComponentBox key={c.key} label={c.label} Icon={c.Icon} indicaciones={c.comp.indicaciones} />
          ))}
        </div>
      ) : null}

      <div className="mt-3 rounded-lg border border-clinical-optimal/30 bg-clinical-optimal-bg p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-clinical-optimal">
          Seguimiento
        </p>
        <p className="text-sm text-foreground">Frecuencia: {ruta.seguimiento.frecuencia}</p>
        <p className="text-sm text-foreground">Egreso: {ruta.seguimiento.criterioEgreso}</p>
      </div>
    </div>
  );
}

export function RutasSection({ rutas }: { rutas: RutaContent[] }) {
  const n = rutas.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rutas de atención activadas</CardTitle>
        <span className="text-sm text-muted-foreground">
          Derivadas automáticamente del Diagnóstico Funcional Integrado (DFI). {n} ruta
          {n === 1 ? "" : "s"} activa{n === 1 ? "" : "s"}.
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {n === 0 ? (
          <p className="text-sm text-muted-foreground">Sin rutas activas para este estado.</p>
        ) : (
          rutas.map((r) => <RutaCard key={r.id} ruta={r} />)
        )}
      </CardContent>
    </Card>
  );
}
