import { Circle, G, Line, Polyline, Svg, Text as SvgText, View, Text } from "@react-pdf/renderer";

import type { PuntoDelPaciente } from "../data/serie-del-paciente";

// ═══ LA TRAYECTORIA DEL PACIENTE, DIBUJADA (2026-09-20) ═══
//
// QUE SE DIBUJA: peso, masa grasa y masa sin grasa, en kilos, consulta a consulta. Ningun indice del
// modelo (§7.1): la razon completa esta en `serie-del-paciente`.
//
// SVG Y NO UNA IMAGEN: `@react-pdf` dibuja SVG nativo, asi que la grafica es vectorial (se imprime nitida
// a cualquier tamaño) y no hay que generar un PNG en el servidor ni traer una libreria de graficas.
//
// ── LAS TRES REGLAS DE LECTURA QUE ESTA GRAFICA RESPETA ─────────────────────────────────────────
//
// 1. CADA SERIE LLEVA SU ROTULO Y SU ULTIMO VALOR. Un paciente no lee una leyenda de colores: lee "peso
//    72,4 kg" al final de la linea.
// 2. EL EJE NO ARRANCA EN CERO, y se dice por que: con tres series que van de 20 a 80 kg, forzar el cero
//    aplasta las tres y no se ve ningun cambio. Lo que importa aqui es la TENDENCIA.
// 3. Y SI HAY UN SOLO PUNTO no se dibuja nada: una trayectoria de un punto no es una trayectoria, y una
//    linea plana inventada seria peor que no mostrar nada.

const ANCHO = 500;
const ALTO = 150;
const MARGEN = { arriba: 12, abajo: 22, izquierda: 8, derecha: 78 };

// Los tres colores: capa de INTERFAZ, no de riesgo. Ninguno insinua bien ni mal, que es lo que BRAND.md
// protege: aqui no hay veredicto, hay tres medidas.
const SERIES = [
  { clave: "pesoKg" as const, rotulo: "Peso", color: "#1d4ed8" },
  { clave: "grasaKg" as const, rotulo: "Masa grasa", color: "#b45309" },
  { clave: "magraKg" as const, rotulo: "Masa sin grasa", color: "#047857" },
];

/** dd/mm, que es lo que cabe bajo un punto sin pisar al vecino. */
function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

const uno = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function GraficaTrayectoria({ puntos }: { puntos: PuntoDelPaciente[] }) {
  if (puntos.length < 2) return null;

  const valores = puntos.flatMap((p) => SERIES.map((s) => p[s.clave]).filter((v): v is number => v != null));
  if (valores.length === 0) return null;

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  // Un margen del 10% arriba y abajo para que las lineas no toquen los bordes. Si todas las medidas
  // fueran identicas, `rango` seria 0 y la division reventaria: se fuerza a 1.
  const rango = Math.max(1, max - min) * 1.2;
  const base = min - Math.max(1, max - min) * 0.1;

  const x = (i: number): number =>
    MARGEN.izquierda +
    (i * (ANCHO - MARGEN.izquierda - MARGEN.derecha)) / Math.max(1, puntos.length - 1);
  const y = (v: number): number =>
    MARGEN.arriba + (1 - (v - base) / rango) * (ALTO - MARGEN.arriba - MARGEN.abajo);

  return (
    <View>
      <Svg width={ANCHO} height={ALTO}>
        {/* La linea del suelo: da referencia sin dibujar una rejilla, que en una hoja del paciente
            distrae mas de lo que ayuda. */}
        <Line
          x1={MARGEN.izquierda}
          y1={ALTO - MARGEN.abajo}
          x2={ANCHO - MARGEN.derecha}
          y2={ALTO - MARGEN.abajo}
          stroke="#d4d4d8"
          strokeWidth={1}
        />

        {SERIES.map((s) => {
          const conValor = puntos
            .map((p, i) => ({ v: p[s.clave], i }))
            .filter((d): d is { v: number; i: number } => d.v != null);
          if (conValor.length === 0) return null;
          const ultimo = conValor[conValor.length - 1];
          return (
            <G key={s.clave}>
              <Polyline
                points={conValor.map((d) => `${x(d.i)},${y(d.v)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={1.6}
              />
              {conValor.map((d) => (
                <Circle key={d.i} cx={x(d.i)} cy={y(d.v)} r={2.4} fill={s.color} />
              ))}
              {/* EL ROTULO AL FINAL DE LA LINEA, con su ultimo valor: es lo que evita la leyenda. */}
              <SvgText
                x={x(ultimo.i) + 6}
                y={y(ultimo.v) + 3}
                style={{ fontSize: 8, fill: s.color }}
              >
                {`${s.rotulo}: ${uno(ultimo.v)} kg`}
              </SvgText>
            </G>
          );
        })}

        {puntos.map((p, i) => (
          <SvgText
            key={p.fecha}
            x={x(i)}
            y={ALTO - MARGEN.abajo + 12}
            style={{ fontSize: 7, fill: "#71717a" }}
          >
            {fechaCorta(p.fecha)}
          </SvgText>
        ))}
      </Svg>
      {/* SE DICE QUE EL EJE NO ARRANCA EN CERO. Una grafica que no lo dice exagera los cambios sin
          querer, y el paciente lee "subi muchisimo" donde hubo un kilo. */}
      <Text style={{ fontSize: 7, color: "#71717a", marginTop: 2 }}>
        La escala se ajusta a tus valores para que se vea el cambio: no empieza en cero.
      </Text>
    </View>
  );
}
