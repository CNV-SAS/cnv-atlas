import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatDateOnlyShort } from "@/lib/format/date";
import { DfiRadar } from "@/modules/diagnoses/components/dfi-radar";

import type { SerieSeguimiento } from "../data/serie-types";
import { SerieLinea } from "./serie-linea";

// Las tres visuales de Seguimiento (porte de sus tres bloques, 2026-08-25). Server component puro.

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// ESTADO DE UNA SOLA CONSULTA. Su pantalla dibuja igual con una medicion: el radar compara la misma
// medicion contra si misma y las series pintan un punto suelto. Aqui se dice lo que pasa Y CUANDO
// correspondería la siguiente, con la frecuencia de la ruta que ya calcula el bloque de proximo control.
// Convierte un vacio en informacion, que es lo que el profesional necesita en la primera consulta.
// LA TARJETA DE CAPACITANCIA, QUE APARECE TAMBIEN CON UNA SOLA MEDICION (cotejo 2026-09-05, punto 28).
//
// POR QUE CAMBIA. Todo el bloque de seguimiento estaba detras de "hay dos mediciones", y para el radar y
// las series eso es correcto: con un punto compararian la medicion contra si misma. Pero ESTA tarjeta no
// vive de la trayectoria: vive de la comparacion contra la REFERENCIA POBLACIONAL por sexo y decada. Con
// una sola medicion ya dice donde esta el paciente, que es exactamente lo que su archivo escribe en la
// primera consulta: "Referencia hombres 18-29 años (n=503): P25 2.06 · mediana 2.40 · P75 2.82 nF.
// Ultima medicion: 2.960 nF - Alta (P75-P95)".
//
// Esconderla era el defecto contrario al que solemos vigilar: no mostrar media informacion, sino no
// mostrar ninguna teniendo una lectura completa. La GRAFICA si sigue esperando la segunda: una linea de
// un punto no traza nada, y se dice en vez de dibujar un grafico vacio.
//
// SE ESCRIBEN LOS PERCENTILES Y EL n, no solo la mediana: la mediana dice hacia donde, los percentiles
// dicen cuanto margen hay, y el n es lo que separa una referencia de una cifra afirmada.
function CapacitanciaCard({
  refC,
  puntos,
}: {
  refC: SerieSeguimiento["refC"];
  puntos: { fecha: string; valor: number }[];
}) {
  if (puntos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Capacitancia de membrana (C)</CardTitle>
        {/* TEXTO CORREGIDO (Gildardo 2026-08-27 §9). Decia "Mayor C indica mejor integridad de la
            membrana celular: verde si mejora...", y su articulo de referencia dice lo contrario: la
            capacitancia discrimina masa muscular baja POR ABAJO y obesidad POR ARRIBA (AUC 0,734 por
            IMC), y sube con el IMC. Un paciente que pasa de 2,40 a 4,00 nF puede estar ganando
            adiposidad, no integridad de membrana. */}
        <span className="text-xs text-muted-foreground">
          Según protocolo, C es el parámetro a seguir. Mejorar es acercarse a la mediana de su grupo de
          edad y sexo, no subir: alejarse, en cualquier dirección, no es mejoría.
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {refC ? (
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">
              Referencia {refC.grupo.toLowerCase()} (n={refC.n}): P25 {refC.p25.toFixed(2)} · mediana{" "}
              {refC.mediana.toFixed(2)} · P75 {refC.p75.toFixed(2)} nF.
            </span>{" "}
            Última medición: <strong>{refC.valor.toFixed(3)} nF</strong> ·{" "}
            <strong>{refC.etiqueta}</strong>
            {refC.banda ? ` (${refC.banda})` : ""}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No se puede comparar con su grupo porque falta el sexo o la fecha de nacimiento del paciente,
            así que la medición se muestra sin calificarla.
          </p>
        )}
        {/* LA GRAFICA SE DIBUJA DESDE LA PRIMERA MEDICION, y esto corrige lo que yo mismo escribi el
            05: entonces la escondia con un punto ("una linea de un punto no traza nada"). Es verdad de
            una linea SUELTA, y falso en cuanto hay una REFERENCIA: el punto contra la mediana de su
            grupo dice donde esta el paciente, que es justo lo que la tarjeta viene a decir. Su archivo
            la dibuja igual. La regla que queda, y vale para las tres graficas de esta pantalla: con
            linea de referencia se dibuja desde la primera; el RADAR no, porque ahi la referencia es la
            otra medicion y con una sola se compara consigo misma. */}
        {puntos.length > 0 ? (
          <SerieLinea
            puntos={puntos}
            // Con referencia, `SerieLinea` ya calcula la mejora como ACERCARSE, que es su regla; sin ella
            // no hay criterio de direccion. NUNCA `true`: pintar de verde el tramo que sube afirmaria
            // justo lo que Gildardo retiro (la capacitancia sube con el IMC, asi que subir puede ser
            // adiposidad y no integridad de membrana).
            {...(refC
              ? { referencia: refC.mediana, referenciaLabel: `Mediana ${refC.grupo}` }
              : {})}
            subirEsMejor={null}
            ariaLabel={`Capacitancia de membrana: ${puntos
              .map((p) => `${formatDateOnlyShort(p.fecha)} ${p.valor.toFixed(3)}`)
              .join(", ")}.`}
          />
        ) : null}
        {puntos.length < 2 ? (
          <p className="text-xs text-muted-foreground">
            Con una sola medición lo que se lee es la <strong>posición</strong> frente a su grupo; la
            trayectoria aparece con la segunda.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// EL AVISO DE QUE FALTA LA SEGUNDA MEDICION. Ya NO trae la tarjeta de capacitancia: desde el tercer
// smoke el bloque visual entero se muestra tambien con una sola medicion (las tres graficas llevan
// linea de referencia, asi que dicen POSICION aunque no haya trayectoria), y lo unico que este aviso
// tiene que hacer es decir que falta la segunda y cuando corresponderia.
export function SeguimientoSinPrevia({
  fechaSugerida,
  frecuencia,
}: {
  fechaSugerida: string | null;
  frecuencia: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seguimiento funcional</CardTitle>
      </CardHeader>
      <CardContent>
        <Aviso>
          Este paciente tiene una sola medición, así que todavía no hay trayectoria que mostrar. La
          comparación aparece con la segunda.
          {frecuencia && fechaSugerida ? (
            <>
              {" "}
              Según la ruta activa ({frecuencia.toLowerCase()}), correspondería alrededor del{" "}
              <strong>{formatDateOnlyShort(fechaSugerida)}</strong>.
            </>
          ) : null}
        </Aviso>
      </CardContent>
    </Card>
  );
}
export function SeguimientoVisual({ serie }: { serie: SerieSeguimiento }) {
  const puntosC = serie.puntos
    .filter((p) => p.c != null)
    .map((p) => ({ fecha: p.fecha, valor: p.c as number }));
  const puntosPabu = serie.puntos
    .filter((p) => p.pabu != null)
    .map((p) => ({ fecha: p.fecha, valor: p.pabu as number }));
  const puntosIca = serie.puntos
    .filter((p) => p.icaBis != null)
    .map((p) => ({ fecha: p.fecha, valor: p.icaBis as number }));

  const conDominios = serie.puntos.filter((p) => p.dominios && p.dominios.length > 0);
  const inicial = conDominios[0] ?? null;
  const ultima = conDominios.length > 1 ? conDominios[conDominios.length - 1] : null;
  // Las mediciones del MEDIO no se dibujan en el radar: compara inicial contra última, como el suyo. Se
  // dice cuántas quedan fuera en vez de callarlo; su trayectoria punto a punto está en las series de
  // arriba, que sí muestran todos los puntos.
  const intermedias = Math.max(0, conDominios.length - 2);

  return (
    <div className="flex flex-col gap-4">
      {serie.omitidas > 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Se muestran las últimas {serie.puntos.length} mediciones.{" "}
          {serie.omitidas === 1 ? "Una anterior no se grafica" : `${serie.omitidas} anteriores no se grafican`}.
        </p>
      ) : null}

      <CapacitanciaCard refC={serie.refC} puntos={puntosC} />
      {inicial && ultima ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diagnóstico funcional: inicial y última</CardTitle>
            <span className="text-xs text-muted-foreground">
              Estado de los cinco dominios en la primera medición ({formatDateOnlyShort(inicial.fecha)}) y en
              la última ({formatDateOnlyShort(ultima.fecha)}). A menor polígono, mejor estado funcional.
              {intermedias > 0
                ? ` ${intermedias === 1 ? "Una medición intermedia" : `${intermedias} mediciones intermedias`} no se dibujan aquí; su trayectoria está en las series.`
                : ""}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <DfiRadar
              domains={ultima.dominios!}
              comparar={inicial.dominios!}
              fechaComparar={formatDateOnlyShort(inicial.fecha)}
              fechaActual={formatDateOnlyShort(ultima.fecha)}
            />
          </CardContent>
        </Card>
      ) : null}

      {puntosPabu.length > 0 || puntosIca.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convergencia bioeléctrica: PABU e ICA-BIS</CardTitle>
            <span className="text-xs text-muted-foreground">
              PABU debe acercarse a φ = 1,618 (línea punteada). ICA-BIS es la distancia a φ: el objetivo es
              que tienda a 0.
              {serie.puntos.length < 2
                ? " Con una sola medición se ve la posición frente al objetivo; la trayectoria aparece con la segunda."
                : ""}
            </span>
          </CardHeader>
          {/* Dos gráficos separados, como en su pantalla: tienen escalas y objetivos distintos, y juntarlos
              habría sido peor. Cada uno con su viewBox, así que ninguno se desborda sobre el otro. */}
          <CardContent className="grid gap-6 lg:grid-cols-2">
            {puntosPabu.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-foreground">PABU hacia φ (1,618)</span>
                <SerieLinea
                  puntos={puntosPabu}
                  referencia={1.618}
                  referenciaLabel="φ = 1,618"
                  ariaLabel={`PABU: ${puntosPabu.map((p) => `${formatDateOnlyShort(p.fecha)} ${p.valor.toFixed(3)}`).join(", ")}. Objetivo 1,618.`}
                />
              </div>
            ) : null}
            {puntosIca.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-foreground">ICA-BIS hacia 0 (distancia a φ)</span>
                <SerieLinea
                  puntos={puntosIca}
                  referencia={0}
                  referenciaLabel="objetivo 0"
                  ariaLabel={`ICA-BIS: ${puntosIca.map((p) => `${formatDateOnlyShort(p.fecha)} ${p.valor.toFixed(4)}`).join(", ")}. Objetivo 0.`}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
