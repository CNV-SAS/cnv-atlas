import { efrRiskRank } from "@/clinical-engine";

// La Diana EFR: grafico polar de los 81 estados (imagen caracteristica de Atlas, BRAND).
// 9 sectores angulares (sector funcional FyR = IFC x IRC) x 9 anillos radiales (fenotipo
// estructural = FFMI x FMI) = 81 celdas. Cada celda se pinta con el gradiente de riesgo
// verde->rojo del prototipo de Gildardo (menor riesgo al centro, mayor en el exterior); la
// celda del paciente se resalta. Port de render fiel (ATLAS_v7.html, DianaEFyR ~L4375-4605):
// no toca el motor congelado ni los golden clinicos, es presentacion. Accesible: la posicion
// del paciente no depende solo del color (marcador, numero y etiqueta). Server component puro.

type Bands = { ifc: number; irc: number; ffmi: number; fmi: number }; // k 1/2/3 cada uno

const SIZE = 320;
const C = SIZE / 2;
const R = 138; // deja margen para las etiquetas de sector en el borde
const HOLE = 26;
const SECTORS = 9;
const RINGS = 9;
const SECTOR_DEG = 360 / SECTORS;
const BAND = (R - HOLE) / RINGS;

// Paradas del gradiente de riesgo, VERBATIM del prototipo (ATLAS_v7.html, rc() ~L4517). Verde
// (bajo riesgo) -> rojo oscuro (alto). El color es SEMANTICA de riesgo, no decoracion.
const STOPS = [
  { t: 0, r: 34, g: 197, b: 94 },
  { t: 0.12, r: 74, g: 222, b: 128 },
  { t: 0.25, r: 163, g: 230, b: 53 },
  { t: 0.35, r: 234, g: 179, b: 8 },
  { t: 0.45, r: 245, g: 158, b: 11 },
  { t: 0.55, r: 249, g: 115, b: 22 },
  { t: 0.65, r: 239, g: 68, b: 68 },
  { t: 0.78, r: 220, g: 38, b: 38 },
  { t: 0.9, r: 185, g: 28, b: 28 },
  { t: 1, r: 127, g: 29, b: 29 },
] as const;

// Escala de referencia (gradiente de riesgo) para la leyenda, desde las mismas paradas del color.
const SCALE_GRADIENT = STOPS.map((s) => `rgb(${s.r},${s.g},${s.b}) ${Math.round(s.t * 100)}%`).join(
  ", ",
);

// Color de una celda a partir de los rangos de riesgo (1..9) de su sector y su anillo. Misma
// interpolacion que el HTML: t = (a + b - 2) / 16, sobre las 10 paradas.
function riskColor(a: number, b: number): string {
  const t = (a + b - 2) / 16;
  let i = 0;
  while (i < STOPS.length - 1 && STOPS[i + 1].t < t) i++;
  if (i >= STOPS.length - 1) {
    const z = STOPS[STOPS.length - 1];
    return `rgb(${z.r},${z.g},${z.b})`;
  }
  const x = STOPS[i];
  const z = STOPS[i + 1];
  const l = (t - x.t) / (z.t - x.t);
  return `rgb(${Math.round(x.r + (z.r - x.r) * l)},${Math.round(x.g + (z.g - x.g) * l)},${Math.round(x.b + (z.b - x.b) * l)})`;
}

function polar(r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180; // 0 grados arriba
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

// Path de un segmento anular (una celda) entre dos radios y dos angulos.
function segment(rInner: number, rOuter: number, aStart: number, aEnd: number): string {
  const [x1, y1] = polar(rOuter, aStart);
  const [x2, y2] = polar(rOuter, aEnd);
  const [x3, y3] = polar(rInner, aEnd);
  const [x4, y4] = polar(rInner, aStart);
  // Cada sector es 40 grados (< 180) -> large-arc flag siempre 0.
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z`;
}

export function Diana({
  bands,
  stateNumber,
  frSectorName,
  structuralName,
}: {
  bands: Bands;
  stateNumber: number;
  frSectorName: string;
  structuralName: string;
}) {
  // Posicion del paciente por RANGO de riesgo (no por banda cruda): asi la celda cae donde la
  // pone la Diana de Gildardo. sectorIndex = rango de IFC x IRC; ringIndex = rango de FFMI x FMI.
  const sectorIndex = efrRiskRank(bands.ifc, bands.irc); // 0..8
  const ringIndex = efrRiskRank(bands.ffmi, bands.fmi); // 0..8 (0 = interior, menor riesgo)

  // Las 81 celdas, ordenadas por rango: sc/rg 0..8 son directamente el rango. El color usa
  // rango+1 (1..9), igual que el prototipo.
  const cells: { key: string; d: string; fill: string; isPat: boolean }[] = [];
  for (let rg = 0; rg < RINGS; rg++) {
    const rInner = HOLE + rg * BAND;
    const rOuter = rInner + BAND;
    for (let sc = 0; sc < SECTORS; sc++) {
      const aStart = sc * SECTOR_DEG;
      const aEnd = aStart + SECTOR_DEG;
      cells.push({
        key: `${rg}-${sc}`,
        d: segment(rInner, rOuter, aStart, aEnd),
        fill: riskColor(sc + 1, rg + 1),
        isPat: sc === sectorIndex && rg === ringIndex,
      });
    }
  }

  // Celda y marcador del paciente.
  const patInner = HOLE + ringIndex * BAND;
  const patOuter = patInner + BAND;
  const patStart = sectorIndex * SECTOR_DEG;
  const patD = segment(patInner, patOuter, patStart, patStart + SECTOR_DEG);
  const [mx, my] = polar((patInner + patOuter) / 2, patStart + SECTOR_DEG / 2);

  const label = `Diana EFR: estado ${stateNumber} de 81, resaltado sobre el gradiente de riesgo (menor al centro, mayor en el exterior). Sector funcional ${frSectorName}, fenotipo estructural ${structuralName}.`;

  return (
    <figure className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={label}
        className="max-w-full"
      >
        {/* Las 81 celdas pintadas por su nivel de riesgo. Separadores blancos semitranslucidos
            (visibles sobre cualquier celda en ambos temas). */}
        {cells.map((cell) => (
          <path
            key={cell.key}
            d={cell.d}
            fill={cell.fill}
            stroke="white"
            strokeOpacity={0.7}
            strokeWidth={1}
          />
        ))}
        {/* Etiquetas de lectura: sectores S1-S9 en el borde (angular, IFC x IRC), anillos R1-R9
            sobre el radio superior (radial, FFMI x FMI), y el centro. Son rotulos fijos de eje. */}
        {Array.from({ length: SECTORS }, (_, sc) => {
          const [lx, ly] = polar(R + 9, sc * SECTOR_DEG + SECTOR_DEG / 2);
          return (
            <text
              key={`sl${sc}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8}
              className="fill-muted-foreground"
            >
              S{sc + 1}
            </text>
          );
        })}
        {Array.from({ length: RINGS }, (_, rg) => {
          const [lx, ly] = polar(HOLE + rg * BAND + BAND / 2, SECTOR_DEG / 2);
          return (
            <text
              key={`rl${rg}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7}
              fontWeight={700}
              fill="white"
              stroke="#0f172a"
              strokeWidth={0.5}
              style={{ paintOrder: "stroke" }}
            >
              R{rg + 1}
            </text>
          );
        })}
        <text
          x={C}
          y={C}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={7}
          className="fill-muted-foreground"
        >
          EFR
        </text>
        {/* Celda del paciente: contorno de alto contraste sobre el fondo saturado. */}
        <path d={patD} fill="none" className="stroke-foreground" strokeWidth={3} />
        {/* Marcador: aro blanco + numero de estado, para leer la posicion sin depender del color. */}
        <circle cx={mx} cy={my} r={11} fill="white" stroke="#111" strokeWidth={1.5} />
        <text
          x={mx}
          y={my}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fontWeight={700}
          fill="#111"
        >
          {stateNumber}
        </text>
      </svg>
      {/* Escala de referencia: el gradiente de riesgo, de menor (izquierda) a mayor (derecha). */}
      <div className="flex w-full max-w-[280px] flex-col gap-1">
        <div
          className="h-2 w-full rounded-full"
          style={{ background: `linear-gradient(to right, ${SCALE_GRADIENT})` }}
          aria-hidden
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Menor riesgo</span>
          <span>Mayor riesgo</span>
        </div>
      </div>
      <figcaption className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
        <span>
          Estado {stateNumber} de 81 · sector {frSectorName} · anillo {structuralName}
        </span>
        <span>
          Sectores S1-S9: función celular y riesgo (IFC × IRC). Anillos R1-R9: fenotipo estructural
          (FFMI × FMI), del centro (menor riesgo) al borde.
        </span>
      </figcaption>
    </figure>
  );
}
