import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatDateOnlyShort } from "@/lib/format/date";
import { DfiRadar } from "@/modules/diagnoses/components/dfi-radar";

import {
  respuestaALaIntervencion,
  type Direccion,
  type DeltaSeguimiento,
  type EscenarioDeRespuesta,
  type RespuestaALaIntervencion,
  type SeguimientoDeLaConsulta,
} from "../respuesta-a-la-intervencion";
import { textoPorProducto } from "@/modules/evaluations/respuesta-en-texto";
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
            // LA BANDA P25-P75 ES LO QUE DA ESCALA (cuarto smoke). Con solo la mediana, el eje se
            // estiraba entre el punto y ella, y "Alta (P75-P95)" se leia en el texto pero no se veia en
            // el grafico: no habia donde mirar P75. Con la banda sombreada, que el punto quede por
            // encima de ella ES el diagnostico, sin leer nada.
            {...(refC
              ? {
                  referencia: refC.mediana,
                  referenciaLabel: `Mediana ${refC.grupo}`,
                  banda: [refC.p25, refC.p75] as [number, number],
                  bandaLabel: `Rango normal de su grupo (P25-P75)`,
                }
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
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// RESPUESTA A LA INTERVENCION  ·  v15 §3, 2026-11-07
//
// Su tarjeta compara contra la ULTIMA CONSULTA COMPARABLE y muestra el delta del riesgo integrado del DFI,
// de la capacitancia y de la PABU. La interpretacion (si cada delta es mejoria) la resuelve
// `respuesta-a-la-intervencion`, y aqui solo se pinta: las tres cifras NO mejoran en la misma direccion, y
// una tarjeta que decidiera eso por su cuenta seria la segunda definicion de "mejoro".
//
// LO QUE FALTA SE DICE, no se calla: su tarjeta lleva ademas la adherencia (S1 a S6) y el escenario de su
// tabla 6, y las dos dependen del Modulo S de la encuesta CNV-S, que todavia no existe en Atlas. Su tabla
// 6 cruza el delta del DFI con la adherencia, asi que sin el Modulo S falta una de sus dos columnas. Media
// tabla de decision diria "respuesta compatible con la ruta" sobre un paciente del que no se sabe si
// siguio la ruta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El color y la palabra de una direccion. `null` = no se afirma si mejoro. */
function lecturaDeDireccion(d: Direccion): { texto: string; clase: string } | null {
  if (d === "mejora") return { texto: "mejora", clase: "text-clinical-optimal" };
  if (d === "empeora") return { texto: "empeora", clase: "text-clinical-warning" };
  if (d === "sin-cambio") return { texto: "sin cambio", clase: "text-muted-foreground" };
  return null;
}

/** Una cifra con su delta y, si se puede decir, su lectura. */
function FilaDelta({
  rotulo,
  dato,
  decimales,
  unidad,
  nota,
}: {
  rotulo: string;
  dato: DeltaSeguimiento | null;
  decimales: number;
  unidad?: string;
  /** Por que no se afirma la direccion, cuando no se afirma. */
  nota?: string;
}) {
  if (!dato) return null;
  const n = (v: number) => v.toFixed(decimales).replace(".", ",");
  const signo = dato.delta > 0 ? "+" : "";
  const lectura = lecturaDeDireccion(dato.direccion);
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm text-foreground">
        <span className="font-medium">{rotulo}:</span> {n(dato.antes)} → {n(dato.ahora)}
        {unidad ? ` ${unidad}` : ""}{" "}
        <span className="tabular-nums text-muted-foreground">
          ({signo}
          {n(dato.delta)})
        </span>
        {lectura ? <span className={`ml-1 font-medium ${lectura.clase}`}>{lectura.texto}</span> : null}
      </p>
      {/* SIN REFERENCIA NO SE DICE SI MEJORO, y se dice POR QUE: la capacitancia es bidireccional, asi que
          "subio" no significa nada sin saber de que lado de la mediana de su grupo estaba. */}
      {!lectura && nota ? <p className="text-xs text-muted-foreground">{nota}</p> : null}
    </div>
  );
}

/**
 * ═══ LO QUE RESPONDIO EN LA ENCUESTA DE SEGUIMIENTO (su v15 §3: "la adherencia, S1 a S6 y las
 * mediciones no comparables") ═══
 *
 * SE ESCRIBEN LAS SEIS RESPUESTAS, no solo la adherencia que sale de ellas. La adherencia es un sí o un
 * no derivado de dos preguntas; lo que cambia una decisión clínica es POR QUÉ ("Lo suspendió · Costo" no
 * se atiende igual que "Olvido"), y eso está en el S2. Un resumen que solo dijera "adherencia
 * insuficiente" obligaría a abrir la encuesta para saber qué hacer con el paciente que está delante.
 *
 * Y VA EN NEUTRO, sin color de veredicto: la adherencia no es una severidad clínica, es lo que el
 * paciente refiere. El único color de este bloque es el ámbar de ATENCIÓN de los eventos que dejan la
 * medición fuera del delta, que sí pide algo de quien lee.
 */
function FilaDelModuloS({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor || valor.trim() === "") return null;
  return (
    <p className="text-sm text-foreground">
      <span className="text-muted-foreground">{rotulo}:</span>{" "}
      <span className="font-medium">{valor}</span>
    </p>
  );
}

function ModuloSDeLaConsulta({ s }: { s: SeguimientoDeLaConsulta }) {
  const r = s.respuestas;
  const nombres = r.nombresDeProductos;
  const adherencia =
    s.adherencia == null
      ? // SIN S3 NO HAY MEDIA REGLA, y se dice cuál falta: así quien lee sabe que se arregla
        // preguntándoselo al paciente, no que el sistema no sabe calcularlo.
        "No se puede decir: falta la pregunta del plan de alimentación (S3)"
      : s.adherencia
        ? "Adecuada"
        : "Insuficiente";
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Encuesta de seguimiento (CNV-S)
      </p>
      <FilaDelModuloS rotulo="Adherencia" valor={adherencia} />
      <FilaDelModuloS
        rotulo="Cómo tomó lo indicado (S1)"
        valor={r.s1 ? textoPorProducto(JSON.stringify(r.s1), nombres) : null}
      />
      <FilaDelModuloS
        rotulo="Por qué no lo tomó así (S2)"
        valor={r.s2 ? textoPorProducto(JSON.stringify(r.s2), nombres) : null}
      />
      <FilaDelModuloS rotulo="Siguió el plan de alimentación (S3)" valor={r.s3} />
      <FilaDelModuloS rotulo="Eventos desde la última consulta (S4)" valor={(r.s4 ?? []).join(", ")} />
      <FilaDelModuloS rotulo="Intentó cambiar su peso (S5)" valor={r.s5} />
      <FilaDelModuloS rotulo="Cómo describe el cambio (S6)" valor={r.s6} />
      {/* LA MEDICION QUE NO ENTRA AL DELTA: *"se guarda y se informa, pero no entra al delta"* (§3). Se
          dice QUE evento lo decidio, porque es justo lo que el profesional necesita leer al lado de la
          medicion: "no comparable" a secas le obliga a abrir la encuesta para averiguarlo. */}
      {!s.comparable ? (
        <p className="rounded-md border border-attention/40 bg-attention-bg px-3 py-2 text-xs text-attention">
          Esta medición no entra en la comparación: {s.eventos.join(", ").toLocaleLowerCase("es-CO")}. La
          medición se conserva y se informa igual; lo que no se hace es restarla contra la consulta
          anterior, porque el cambio mediría el evento y no la intervención.
        </p>
      ) : null}
    </div>
  );
}

/**
 * ═══ EL ESCENARIO DE SU TABLA 6 ═══
 *
 * Cuatro casillas, dos ejes: el delta del DFI y la adherencia. SIN COLOR DE VEREDICTO, y es deliberado:
 * las cuatro frases son afirmaciones sobre la RUTA, no sobre la gravedad del paciente, y dos de ellas
 * ("mejora no atribuible a la ruta", "exposición insuficiente") se leerían como un reproche en rojo.
 *
 * SE ESCRIBEN LAS DOS COORDENADAS debajo. La casilla sola no se puede auditar: quien la lee tiene que
 * poder ver con qué se eligió, y la misma frase con los ejes al revés sería un error invisible.
 */
function EscenarioDeLaTabla({ e }: { e: EscenarioDeRespuesta }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Escenario de respuesta
      </p>
      <p className="text-sm font-semibold text-foreground">{e.titulo}</p>
      <p className="text-xs text-muted-foreground">
        Riesgo integrado: {e.delta} · adherencia {e.adherencia}. Es la tabla 6 del modelo de seguimiento,
        que cruza esas dos.
      </p>
    </div>
  );
}

function RespuestaCard({ r }: { r: RespuestaALaIntervencion }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Respuesta a la intervención</CardTitle>
        <span className="text-xs text-muted-foreground">
          {r.anterior ? (
            <>
              Comparado con la consulta del {formatDateOnlyShort(r.anterior.fecha)}, que es la última de la
              misma versión del modelo. El riesgo integrado va de 0 a 100 y menor es mejor; la capacitancia
              y la proporción bioeléctrica son bidireccionales, así que mejorar es acercarse a su
              referencia.
            </>
          ) : (
            // SIN PAREJA LA TARJETA SIGUE SALIENDO, con lo que SI es de esta consulta (la adherencia y los
            // eventos). Y se dice que no hay con qué comparar, en vez de dejar la tarjeta sin filas y que
            // parezca que algo no cargó.
            <>
              No hay una consulta anterior con la que comparar las cifras: o es la primera, o la anterior se
              selló con otra versión del modelo, o esta medición quedó fuera de la comparación. Lo que sigue
              es lo que el paciente respondió en esta consulta.
            </>
          )}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <FilaDelta rotulo="Riesgo integrado (DFI)" dato={r.riesgo} decimales={0} />
        <FilaDelta
          rotulo="Capacitancia de membrana"
          dato={r.capacitancia}
          decimales={3}
          unidad="nF"
          nota="No hay referencia poblacional de su grupo (falta sexo o fecha de nacimiento), así que se dice cuánto se movió y no si eso es mejoría: acercarse a la mediana es mejorar, y alejarse en cualquier dirección, no."
        />
        <FilaDelta rotulo="Proporción bioeléctrica (PABU)" dato={r.pabu} decimales={3} />
        {r.escenario ? <EscenarioDeLaTabla e={r.escenario} /> : null}
        {r.seguimiento ? <ModuloSDeLaConsulta s={r.seguimiento} /> : null}
        {/* ═══ POR QUE AQUI YA NO HAY UN AVISO DE "ESTO LLEGA CON LA CNV-S" ═══

            Lo hubo desde el 7 de noviembre, y decía la verdad: la adherencia y el escenario de su tabla 6
            dependen del Módulo S, que no existía. Desde el 9 de noviembre existe, se guarda y se lee, así
            que el aviso pasó a ser lo contrario de lo que se escribió para evitar: una pantalla diciendo
            que falta algo que ya está.

            LO QUE SE CONSERVA ES LA REGLA, no el aviso: cuando falta uno de los dos ejes, el escenario no
            se dice (`escenarioDeLaTabla6` devuelve null) y el bloque de arriba explica cuál falta. */}
        {!r.seguimiento ? (
          <p className="mt-1 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Esta consulta se respondió con la encuesta completa (CNV v2.0), que no lleva el módulo de
            seguimiento: no hay adherencia que leer, así que el escenario de respuesta no se puede decidir.
            Las cifras de arriba sí comparan.
          </p>
        ) : null}
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

  // LA RESPUESTA A LA INTERVENCION (su v15 §3): null con una sola consulta o sin ninguna anterior de la
  // MISMA escala del motor, y entonces la tarjeta no sale. No se pinta vacia: con una medicion no hay
  // respuesta a nada.
  const respuesta = respuestaALaIntervencion(serie.puntos, serie.refC);

  const conDominios = serie.puntos.filter((p) => p.dominios && p.dominios.length > 0);
  // LA DIANA SALE CON UNA SOLA MEDICION desde el 2026-09-07 (punto 13 de su cotejo). Antes exigia dos y
  // con una no se dibujaba nada. Textual suyo: *"en mod seguimiento se debe poner la diana del DFI, ¿por
  // qué la quitaron?"*
  //
  // LA DECISION DE EXIGIR DOS ERA NUESTRA Y ERA LA EQUIVOCADA, y el motivo por el que se ve ahora es mas
  // fuerte que el de la capacitancia: alli hacia falta una REFERENCIA (la mediana del grupo) para que un
  // punto suelto significara algo. Aqui la escala YA es la referencia. Los cinco ejes van de Optimo a
  // Critico, que son niveles absolutos, no relativos a otra medicion. Un poligono solo se lee.
  //
  // Y ES LO QUE EL PARAMETRIZO: "que quede de fondo la inicial y sobre esa se muestra la diana nueva
  // superpuesta". El fondo es el segundo poligono. Con una medicion no hay fondo todavia; con la segunda
  // aparece, sin que la primera consulta se quede sin nada que ensenar.
  const ultima = conDominios[conDominios.length - 1] ?? null;
  // El INICIAL solo cuenta como comparacion si NO es el mismo punto que la ultima. Con una medicion los
  // dos serian el mismo, y dibujar un poligono punteado exactamente encima del solido diria "no ha
  // cambiado nada" sobre algo que ni siquiera se ha medido dos veces.
  const inicial = conDominios.length > 1 ? conDominios[0] : null;
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

      {/* VA PRIMERA, antes de la capacitancia y del radar: es la lectura de CONJUNTO de si el paciente
          respondio a la intervencion, y lo que sigue es el detalle indicador por indicador. Al reves,
          quien lee las tres cifras ya no necesita la tarjeta. */}
      {respuesta ? <RespuestaCard r={respuesta} /> : null}

      <CapacitanciaCard refC={serie.refC} puntos={puntosC} />
      {ultima ? (
        <Card>
          <CardHeader>
            {/* EL TITULO Y EL TEXTO DERIVAN DE SI HAY COMPARACION, no son una cadena fija. Decir "inicial
                y última" con una sola medición sería afirmar una comparación que no hubo, que es el
                defecto que ya nos costó en otras superficies. */}
            <CardTitle className="text-base">
              {inicial ? "Diagnóstico funcional: inicial y última" : "Diagnóstico funcional"}
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {inicial ? (
                <>
                  Estado de los cinco dominios en la primera medición (
                  {formatDateOnlyShort(inicial.fecha)}) y en la última ({formatDateOnlyShort(ultima.fecha)}
                  ). A menor polígono, mejor estado funcional.
                  {intermedias > 0
                    ? ` ${intermedias === 1 ? "Una medición intermedia" : `${intermedias} mediciones intermedias`} no se dibujan aquí; su trayectoria está en las series.`
                    : ""}
                </>
              ) : (
                <>
                  Estado de los cinco dominios en la medición del{" "}
                  {formatDateOnlyShort(ultima.fecha)}. A menor polígono, mejor estado funcional. Con la
                  siguiente consulta esta figura queda de fondo y encima se dibuja la nueva, para ver el
                  cambio.
                </>
              )}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <DfiRadar
              domains={ultima.dominios!}
              comparar={inicial?.dominios ?? undefined}
              fechaComparar={inicial ? formatDateOnlyShort(inicial.fecha) : undefined}
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
