import type { DfiDomain } from "@/clinical-engine";

import { SEV_LABEL } from "../severity-labels";

// Radar de los 5 dominios del DFI (Diagnostico Funcional Integral): una lectura de forma, de un
// vistazo, de la severidad por dominio. Cada eje es un dominio; el radio es la severidad (0 al
// centro = optimo, 3 en el borde = alto), coherente con la Diana (exterior = mayor riesgo). Los
// datos vienen del snapshot inmutable (computeDFI congelado); esto es presentacion pura. El fondo
// muestra las 4 ZONAS de severidad del MOTOR (no las 5 del render del HTML): color de riesgo de la
// paleta clinica BRAND, reservado para severidad. Accesible: la severidad tambien va en texto
// (etiqueta por eje, leyenda y aria-label), no solo en el color. Server component puro, theme-aware.

const SIZE_W = 360;
const SIZE_H = 300;
const CX = 180;
const CY = 140;
const RMAX = 95;
const BANDS = 4; // niveles de severidad del motor: 0 Optimo, 1 Leve, 2 Moderado, 3 Alto

// Nombres cortos de los 5 ejes, EXACTOS del HTML de referencia (ATLAS_v7.html, _RAD_SHORT
// ~L11550). No se usan los nombres largos del snapshot ("Metabolico-Estructural", etc.): el
// radar del HTML rotula asi. Se resuelve por id (d1..d5), no por texto.
const RADAR_LABEL: Record<string, string> = {
  d1: "Celular",
  d2: "Metabólico",
  d3: "Enveje.",
  d4: "Conductual",
  d5: "Epigenét.",
};
// Vocabulario de severidad del MOTOR: fuente unica compartida (severity-labels), la misma que usan
// las tarjetas del DFI, para que no puedan divergir.
// Zonas de fondo por severidad (fill claro de la paleta clinica). sev 0 y 1 comparten el verde,
// igual que el modelo de riesgo (2 alerta, 3 critico). Se pintan del exterior al centro.
const BAND_FILL = [
  "fill-clinical-optimal-bg",
  "fill-clinical-optimal-bg",
  "fill-clinical-warning-bg",
  "fill-clinical-critical-bg",
];
// Cuadro de color solido para la leyenda (color = severidad, nunca decorativo).
const SWATCH = [
  "bg-clinical-optimal",
  "bg-clinical-optimal",
  "bg-clinical-warning",
  "bg-clinical-critical",
];
// Color del poligono de datos por severidad integrada (stroke solido). Tokens BRAND.
const RISK_STROKE = [
  "stroke-clinical-optimal",
  "stroke-clinical-optimal",
  "stroke-clinical-warning",
  "stroke-clinical-critical",
];

function clampSev(s: number): number {
  return Math.min(3, Math.max(0, s));
}

// Punto en el eje i (0..n-1), a un radio dado. Eje 0 arriba, luego en sentido horario.
function axisPoint(i: number, n: number, r: number): [number, number] {
  const a = (-90 + (360 / n) * i) * (Math.PI / 180);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

// Pentagono de los n ejes a un radio dado, como string de puntos.
function ringPoly(n: number, r: number): string {
  return Array.from({ length: n }, (_, i) => axisPoint(i, n, r))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

export function DfiRadar({ domains, riskSev }: { domains: DfiDomain[]; riskSev: number }) {
  const n = domains.length;
  const rs = clampSev(riskSev);
  const dataFill = RISK_STROKE[rs].replace("stroke-", "fill-");

  // Poligono de datos: cada vertice al centro de su zona de severidad ((sev+0.5)/BANDS), como en el
  // radar del HTML, para que el punto caiga dentro de la banda y no sobre su borde.
  const dataPts = domains.map((d, i) => axisPoint(i, n, ((clampSev(d.sev) + 0.5) / BANDS) * RMAX));
  const dataPoly = dataPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const label = `Radar funcional: ${domains
    .map((d) => `${RADAR_LABEL[d.id] ?? d.nombre} ${SEV_LABEL[clampSev(d.sev)]}`)
    .join(", ")}.`;

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${SIZE_W} ${SIZE_H}`}
        width={SIZE_W}
        height={SIZE_H}
        role="img"
        aria-label={label}
        className="max-w-full"
      >
        {/* Zonas de fondo por severidad: pentagonos concentricos del exterior (peor) al centro
            (mejor), pintados en ese orden para que cada zona interior cubra a la de afuera. */}
        {[3, 2, 1, 0].map((k) => (
          <polygon key={`band${k}`} points={ringPoly(n, ((k + 1) / BANDS) * RMAX)} className={BAND_FILL[k]} />
        ))}
        {/* Contorno exterior + radios */}
        <polygon points={ringPoly(n, RMAX)} fill="none" className="stroke-border" strokeWidth={1} />
        {domains.map((_, i) => {
          const [x, y] = axisPoint(i, n, RMAX);
          return <line key={`spoke${i}`} x1={CX} y1={CY} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
        })}
        {/* Poligono de datos (color = severidad integrada) */}
        <polygon
          points={dataPoly}
          className={`${dataFill} ${RISK_STROKE[rs]}`}
          fillOpacity={0.25}
          strokeWidth={2}
        />
        {/* Vertices */}
        {dataPts.map(([x, y], i) => (
          <circle key={`v${i}`} cx={x} cy={y} r={3} className={dataFill} />
        ))}
        {/* Etiquetas de eje: nombre corto fiel del HTML + severidad (vocabulario del motor). */}
        {domains.map((d, i) => {
          const [lx, ly] = axisPoint(i, n, RMAX + 14);
          const cos = Math.cos((-90 + (360 / n) * i) * (Math.PI / 180));
          const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          return (
            <text
              key={`lbl${i}`}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-foreground"
              fontSize={10}
            >
              <tspan x={lx}>{RADAR_LABEL[d.id] ?? d.nombre}</tspan>
              <tspan x={lx} dy={12} className="fill-muted-foreground" fontSize={9}>
                {SEV_LABEL[clampSev(d.sev)]}
              </tspan>
            </text>
          );
        })}
      </svg>
      {/* Leyenda de las 4 zonas de severidad con su color (vocabulario del motor). */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {SEV_LABEL.map((z, k) => (
          <span key={z} className="inline-flex items-center gap-1">
            <span className={`size-2 rounded-[2px] ${SWATCH[k]}`} aria-hidden />
            {z}
          </span>
        ))}
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        A menor polígono, mejor estado.
      </figcaption>
    </figure>
  );
}
