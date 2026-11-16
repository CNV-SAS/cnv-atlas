import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatDate } from "@/lib/format/date";

import type { FollowupComparison as Comparison } from "../data/comparison-reader";

// Comparacion de seguimiento (B13): evaluacion actual frente a la previa. Presentacion pura
// desde el comparador (deltas ya calculados). Vista interna del profesional, lenguaje
// funcional. El delta se muestra sin juzgar direccion clinica (subir o bajar depende del
// indicador); solo informa el cambio numerico y el cambio de estado EFR y de riesgo.

function fmt(v: number | null, code?: string): string {
  if (v == null) return "N/D";
  // D-016: el angulo de fase siempre con 1 decimal (los demas indicadores conservan su formato).
  if (code === "AF") return v.toFixed(1);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function fmtDelta(v: number | null, code?: string): string {
  if (v == null) return "N/D";
  if (v === 0) return "0";
  return v > 0 ? `+${fmt(v, code)}` : fmt(v, code);
}

function fecha(iso: string): string {
  return formatDate(iso);
}

// LECTURA del cambio. La tabla estaba entera en gris: el profesional veia "+4.54" y no sabia si era bueno
// (mismo defecto de "numeros sin lectura" que se arreglo en la tabla de Wang).
//
// El color NO sale del signo del delta: en unos indices subir es mejorar y en otros empeorar, y en el PABU
// lo mejor es acercarse a phi, ni subir ni bajar. Sale de comparar la SEVERIDAD que el clasificador del
// motor le da a cada valor, que es un dato que ya existe.
const LECTURA_CLS: Record<string, string> = {
  mejora: "text-clinical-optimal",
  empeora: "text-clinical-critical",
  igual: "text-muted-foreground",
};
const LECTURA_TXT: Record<string, string> = {
  mejora: "mejora",
  empeora: "empeora",
  igual: "misma lectura",
};

export function FollowupComparison({ comparison }: { comparison: Comparison }) {
  const c = comparison;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparación con la evaluación previa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Evaluacion previa del {fecha(c.previousDate)}, evaluacion actual del {fecha(c.currentDate)}.
        </p>

        {/* ═══ EL AVISO DEL CRUCE DE VERSIONES, AHORA EN DOS GRADOS  ·  Santiago, smoke del 2026-11-15 ═══

            Textual suyo: *"las dos fechas son 13/7/2026, todos los indicadores iguales (cambio 0, mismo
            archivo, es prueba), pero «Riesgo integrado BAJO (20) -> ALTO (25)». Eso sale del cambio de
            motor, no del paciente. Ese bloque tiene que aplicar sonComparables"*.

            LO QUE ESTABA MAL NO ERA EL AVISO, ERA SU ULTIMA FRASE: decia que *"el estado EFR y los
            indicadores siguen siendo comparables"* SIEMPRE que las versiones difirieran. Con el MINOR
            distinto es verdad (ninguna clasificacion se mueve, por construccion). Con el MAYOR distinto
            es falso, y es justo la frase que convierte un aviso en un permiso para leer la resta.

            MISMO MAYOR  -> aviso calmado, como hasta hoy: la mayoria de los seguimientos cruzan minor.
            MAYOR DISTINTO -> aviso de advertencia, y ABAJO no se resta nada (ver la tabla). */}
        {c.engineVersionCross && c.mismaEscala ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Estas dos evaluaciones se calcularon con versiones distintas del motor (
            {c.engineVersionCross.previous} y {c.engineVersionCross.current}), pero de la misma ciencia:
            ninguna clasificación se movió entre las dos. Parte del detalle fino puede venir de la
            actualización; el estado EFR, el riesgo y los indicadores siguen siendo comparables.
          </p>
        ) : null}
        {c.engineVersionCross && !c.mismaEscala ? (
          <p className="rounded-lg border border-clinical-warning bg-clinical-warning-bg p-3 text-xs text-clinical-warning">
            Estas dos evaluaciones se calcularon con <strong>ciencias distintas</strong> del motor (
            {c.engineVersionCross.previous} y {c.engineVersionCross.current}), así que no se pueden
            restar: una diferencia de estado o de riesgo entre ellas puede ser del modelo y no del
            paciente. Por eso abajo se muestran los dos valores y no el cambio. Para compararlas de
            verdad, la evaluación previa tiene que recalcularse con la ciencia de hoy.
          </p>
        ) : null}

        {/* Cambios de estado y riesgo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">Estado EFR</span>
            <span className="text-sm text-foreground">
              {c.previousEfrState} · {c.currentEfrState}
              {/* "CAMBIO" ES UNA AFIRMACION SOBRE EL PACIENTE, y entre dos ciencias no se sostiene: el
                  mismo cuerpo puede caer en otro estado solo porque los cortes se movieron. Se dice lo
                  que si se sabe. */}
              {c.currentEfrState !== c.previousEfrState ? (
                <Badge variant="outline" className="ml-2">
                  {c.mismaEscala ? "cambio" : "otra ciencia"}
                </Badge>
              ) : null}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">Riesgo integrado (DFI)</span>
            <span className="text-sm text-foreground">
              {c.previousRisk.nivel} ({c.previousRisk.score}) · {c.currentRisk.nivel} (
              {c.currentRisk.score})
            </span>
          </div>
        </div>

        {/* Deltas por indicador */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              {/* LA REGLA DE `components/shared/tabla.tsx` (2026-09-10): el encabezado que lleva NOMBRES DE
                  COLUMNA va sin fondo y en negrita, y con su padding a los dos lados. Esta tabla escribia
                  sus clases a mano y se quedo fuera del barrido del 2026-09-03 por no importar nada de
                  ahi, igual que la de composicion. */}
              <tr className="border-b border-border text-left text-[0.8125rem] font-bold uppercase tracking-wide text-foreground">
                <th className="py-2 pl-3 pr-4">Indicador</th>
                <th className="py-2 pr-4">Previo</th>
                <th className="py-2 pr-4">Actual</th>
                <th className="py-2 pr-4">{c.mismaEscala ? "Cambio" : "Cambio (no comparable)"}</th>
                <th className="py-2 pr-3">Lectura</th>
              </tr>
            </thead>
            <tbody>
              {c.indicators.map((it) => (
                <tr key={it.code} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium text-foreground">{it.code}</td>
                  <td className="py-2 pr-4 tabular-nums text-muted-foreground">{fmt(it.previous, it.code)}</td>
                  <td className="py-2 pr-4 tabular-nums text-foreground">{fmt(it.current, it.code)}</td>
                  {/* LA RESTA Y SU LECTURA SOLO CON LA MISMA CIENCIA. Un "+4,54" en verde entre dos
                      mayores distintos es una mejora atribuida al paciente que puede ser del modelo, y es
                      exactamente lo que `sonComparables` existe para impedir (y lo que la serie y la
                      tarjeta de respuesta ya impiden). El guion no es un hueco: es la respuesta. */}
                  <td
                    className={`py-2 pr-4 tabular-nums ${c.mismaEscala && it.lectura ? (LECTURA_CLS[it.lectura] ?? "text-muted-foreground") : "text-muted-foreground"}`}
                  >
                    {c.mismaEscala ? fmtDelta(it.delta, it.code) : "—"}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {!c.mismaEscala
                      ? "no comparable"
                      : it.lectura
                        ? (LECTURA_TXT[it.lectura] ?? "")
                        : "sin clasificar"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Se dice QUE significa el color, y sobre todo que "misma lectura" no es "no cambio": el numero se
            movio, pero se quedo en la misma banda del clasificador. Mientras no exista el cambio minimo
            detectable (pendiente con Gildardo), llamar mejora a un movimiento dentro de la misma banda
            afirmaria mas de lo que sabemos. */}
        {/* LA LEYENDA EXPLICA LA COLUMNA DEL CAMBIO, asi que sin cambio que explicar no va: entre dos
            ciencias esa columna dice «no comparable», y una leyenda sobre el color de algo que no se pinta
            se lee como que la pantalla dejo algo a medias. */}
        {c.mismaEscala ? (
          <p className="text-xs text-muted-foreground">
            El color del cambio sale de la clasificación del modelo, no del signo: en unos índices subir es
            mejorar y en otros empeorar, y el PABU mejora al acercarse a φ. <strong>Misma lectura</strong>{" "}
            quiere decir que el valor se movió pero sigue en el mismo nivel clínico.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
