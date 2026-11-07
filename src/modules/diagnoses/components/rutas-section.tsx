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
// SU CONTENIDO TRAE GUIONES LARGOS y no se edita su archivo (rompería la fidelidad del port y sus golden
// tests): se limpian AQUI, que es donde los ve una persona. Ver `lib/format/guion`.
import { sinGuionLargo } from "@/lib/format/guion";
import { activadorDeLaRuta } from "@/clinical-engine/activador-de-la-ruta";
import type { RutaComponent, RutaContent } from "@/clinical-engine/rutas-content";
import type { DfiDomain } from "@/clinical-engine/types";

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
        {indicaciones.map(sinGuionLargo).map((ind, i) => (
          <li key={i}>{ind}</li>
        ))}
      </ul>
    </div>
  );
}

function RutaCard({ ruta, domains }: { ruta: RutaContent; domains?: DfiDomain[] | null }) {
  const Icon = ROUTE_ICON[ruta.id] ?? Zap;
  const accent = ROUTE_ACCENT[ruta.id] ?? "var(--primary)";
  const { nutricional, ejercicio, psicologico } = ruta.componentes;
  const activador = activadorDeLaRuta(ruta.id, domains);
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
          {/* ═══ Y LO QUE LA ACTIVO DE VERDAD EN ESTA CONSULTA  ·  2026-11-07 ═══

              El renglon de arriba es el rotulo de Gildardo, verbatim, y describe SU OTRA regla para la
              ruta (el predicado `condicion`, que no decide nada). La activacion de verdad es el DFI. El
              smoke de `ed83ff97` mostro la R1 con "IFC bajo + IRC alto + IAE acelerado" sobre un IRC de
              2,71, que es Normal: el rotulo se leia como el motivo de ESA consulta.

              No se edita ninguna de las dos cosas (las dos son suyas: Regla 0, y la pregunta va en
              PENDIENTES 38). Se AÑADE el dato sellado, que es lo que la Regla 0 si permite mostrar. */}
          {activador ? <p className="text-xs text-muted-foreground">{activador}</p> : null}
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
        <p className="text-sm text-foreground">Frecuencia: {sinGuionLargo(ruta.seguimiento.frecuencia)}</p>
        <p className="text-sm text-foreground">Egreso: {sinGuionLargo(ruta.seguimiento.criterioEgreso)}</p>
      </div>
    </div>
  );
}

// ═══ TRES ESTADOS, NO DOS  ·  2026-11-07 ═══
//
// "Sin rutas activas para este estado" es un RESULTADO CLINICO; que la capa del snapshot no se haya
// escrito es un DEFECTO NUESTRO, y los dos se veian igual. La reemision del 7 de noviembre dejo 422
// informes sin esa capa, y esta tarjeta decia "0 rutas activas" al lado de un riesgo integrado CRITICO:
// un vacio leido como resultado. Es la misma distincion que ya estaba en las tarjetas de dominio ("Sin
// dato" no es "Óptimo") y en el clamp del radar.
export function RutasSection({
  rutas,
  ausente = false,
  domains,
}: {
  rutas: RutaContent[];
  /** La capa no se escribio (no que no haya rutas). Ver `results-reader.rutasContentAusente`. */
  ausente?: boolean;
  /** Los dominios SELLADOS de esta consulta, para decir que activo cada ruta. Ausentes en snapshots viejos. */
  domains?: DfiDomain[] | null;
}) {
  const n = rutas.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rutas de atención activadas</CardTitle>
        <span className="text-sm text-muted-foreground">
          {ausente ? (
            "Derivadas automáticamente del Diagnóstico Funcional Integrado (DFI)."
          ) : (
            <>
              Derivadas automáticamente del Diagnóstico Funcional Integrado (DFI). {n} ruta
              {n === 1 ? "" : "s"} activa{n === 1 ? "" : "s"}.
            </>
          )}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ausente ? (
          // NO SE AFIRMA CUANTAS SON. El diagnóstico de esta consulta se volvió a emitir y el contenido de
          // sus rutas está pendiente de completarse; decir "0" sería afirmar un resultado que no se midió.
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">
                Las rutas de esta consulta se están completando.
              </strong>{" "}
              El diagnóstico se reemitió con la versión nueva del modelo y el contenido de sus rutas queda
              pendiente de un paso que corre la Dirección Científica. No es que no haya rutas: es que
              todavía no se pueden mostrar. El resto del diagnóstico y el plan no dependen de esto.
            </p>
          </div>
        ) : n === 0 ? (
          <p className="text-sm text-muted-foreground">Sin rutas activas para este estado.</p>
        ) : (
          rutas.map((r) => <RutaCard key={r.id} ruta={r} domains={domains} />)
        )}
      </CardContent>
    </Card>
  );
}
