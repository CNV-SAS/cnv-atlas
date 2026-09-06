import { AlertTriangle } from "lucide-react";
import { dxSarcopenia } from "@/clinical-engine/protocolo-fenotipo";

import { clasificarASMI, type DisplayDx, dAF } from "../data/composition-display";
import { SEV_CLS } from "./risk-severity";

// Diagnostico de Sarcopenia (port de la card de Gildardo en "Antrop. & BIS"). Criterio EWGSOP2: los tres
// pilares son FUERZA (primario), MASA (ASMI) y CALIDAD celular (AF). Los cortes son del motor (cASMI/cAF,
// sexo-dependientes; fuerza EWGSOP2 M<27 / F<16 Kgf). Presentacion: LEE del motor, no lo toca.
//
// FUERZA PRENSIL (dinamometria, criterio PRIMARIO del EWGSOP2): se captura en las condiciones de la toma BIS
// (campo gripStrengthKg, subpestaña Encuesta), la mide el profesional en consulta. Si no la registro, la card
// dice "Sin dato" y remite a capturarla, NO queda vacia ni se inventa. Su ausencia se hace visible.
//
// Y DESDE EL 2026-08-31 TAMBIEN ALIMENTA EL MOTOR (Gildardo §6 del 30). Antes esta card era el UNICO sitio
// donde el dato se usaba: `classifyFenotipo` recibia siempre 0 y `dxSarcopenia` cortaba pidiendo la fuerza
// aunque estuviera registrada. O sea que la card mostraba un numero que ningun calculo leia.

function Metric({
  label,
  value,
  unit,
  cut,
  dx,
}: {
  label: string;
  value: string;
  unit?: string;
  cut: string;
  dx: DisplayDx;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-foreground">{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {dx ? (
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEV_CLS[Math.min(3, Math.max(0, dx.sev))]}`}>
            {dx.label}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">{cut}</span>
      </div>
    </div>
  );
}

// LA BANDA POR `k`, no por su hexadecimal. Es un veredicto sobre el PACIENTE, asi que aqui la capa
// clinica es la correcta (a diferencia de los estados de proceso, que van en el eje operativo).
const BANDA_SARCO: Record<number, string> = {
  0: "border-clinical-optimal/40 bg-clinical-optimal-bg text-clinical-optimal",
  1: "border-clinical-warning/40 bg-clinical-warning-bg text-clinical-warning",
  2: "border-clinical-critical/40 bg-clinical-critical-bg text-clinical-critical",
  3: "border-clinical-critical/60 bg-clinical-critical-bg text-clinical-critical",
};

export function SarcopeniaCard({
  asmi,
  af,
  sexoM,
  // Fuerza prensil (dinamometria). null = el profesional no la registro. Ver la nota de arriba.
  fuerzaPrensil = null,
}: {
  asmi: number | null;
  af: number | null;
  sexoM: boolean;
  fuerzaPrensil?: number | null;
}) {
  // EL VEREDICTO sale de SU clasificador, el mismo que alimenta el fenotipo del protocolo. Con la fuerza
  // sin registrar devuelve "Ingrese fuerza prensil", que ya lo dice el aviso de abajo, asi que ahi no se
  // pinta: seria decir dos veces lo mismo.
  const veredicto =
    fuerzaPrensil == null || asmi == null || af == null
      ? null
      : dxSarcopenia(fuerzaPrensil, asmi, af, sexoM);

  const fuerzaCut = sexoM ? 27 : 16; // EWGSOP2 Kgf
  const asmiCut = sexoM ? "7.0" : "5.5";
  const afCut = sexoM ? "6.5" : "6.0";
  const fuerzaDx: DisplayDx =
    fuerzaPrensil == null
      ? null
      : fuerzaPrensil < fuerzaCut
        ? { label: "Bajo", sev: 3 }
        : { label: "Normal", sev: 0 };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground">Diagnóstico de sarcopenia</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="Fuerza prensil"
          value={fuerzaPrensil != null ? fuerzaPrensil.toFixed(1) : "Sin dato"}
          unit={fuerzaPrensil != null ? "Kgf" : undefined}
          cut={`Bajo: <${fuerzaCut} Kgf`}
          dx={fuerzaDx}
        />
        <Metric
          label="ASMI"
          value={asmi != null ? asmi.toFixed(2) : "Sin dato"}
          unit={asmi != null ? "kg/m²" : undefined}
          cut={`Bajo: <${asmiCut}`}
          dx={clasificarASMI(asmi, sexoM)}
        />
        <Metric
          label="Ángulo de fase"
          value={af != null ? af.toFixed(1) : "Sin dato"}
          unit={af != null ? "°" : undefined}
          cut={`Bajo: <${afCut}°`}
          dx={dAF(af, sexoM)}
        />
      </div>
      {/* EL VEREDICTO, que es lo que faltaba (cotejo 2026-09-05, punto 8b). Su archivo cierra este bloque
          con la conclusion ("Sin sarcopenia · Fuerza y masa muscular normales") y Atlas mostraba las tres
          tarjetas SIN ella: el profesional veia tres datos y tenia que concluir el. Es el criterio de "lo
          que el tiene y nosotros no".
          SALE DE SU CLASIFICADOR, no de una regla nuestra: `dxSarcopenia` es el mismo que ya alimenta el
          fenotipo del protocolo, asi que la tarjeta y la prescripcion no pueden decir cosas distintas.
          Y LA SEVERIDAD SE TOMA DE SU `k`, no de su hex: el color se deriva del clasificador (misma regla
          que aprendimos con el azul del frozen, que pintaba un desnutrido como optimo). */}
      {veredicto != null ? (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${BANDA_SARCO[veredicto.k] ?? BANDA_SARCO[0]}`}>
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{veredicto.l}</span>
            <span className="text-xs opacity-90">{veredicto.detalle}</span>
          </span>
        </div>
      ) : null}
      {fuerzaPrensil == null ? (
        <div className="flex items-start gap-2 rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Falta la dinamometría</span> (fuerza prensil), el criterio
            primario del EWGSOP2. Regístrala en las condiciones de la toma BIS (subpestaña Encuesta): la
            mide el profesional con dinamómetro, mano dominante, mejor de tres intentos.
          </span>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Criterio EWGSOP2: fuerza prensil (primario) + masa muscular (ASMI) + calidad celular (ángulo de
        fase). Los cortes se ajustan por sexo.
      </p>
    </section>
  );
}
