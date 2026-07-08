// La Diana EFR: gráfico polar de los 81 estados (imagen característica de Atlas, BRAND).
// 9 sectores angulares (sector funcional FyR = IFC x IRC) x 9 anillos radiales (fenotipo
// estructural = FFMI x FMI) = 81 celdas. Se resalta la celda del paciente. Accesible: no
// depende solo del color (tambien posicion y etiqueta); SVG propio, sin librerias de charts.
// Server component puro (sin estado); theme-aware via clases de Tailwind (fill/stroke).

type Bands = { ifc: number; irc: number; ffmi: number; fmi: number }; // k 1/2/3 cada uno

const SIZE = 320;
const C = SIZE / 2;
const R = 150;
const HOLE = 26;
const SECTORS = 9;
const RINGS = 9;
const SECTOR_DEG = 360 / SECTORS;
const BAND = (R - HOLE) / RINGS;

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
  // Indice angular (sector) y radial (anillo) del paciente, a partir de las 4 bandas.
  const sectorIndex = (bands.ifc - 1) * 3 + (bands.irc - 1); // 0..8
  const ringIndex = (bands.ffmi - 1) * 3 + (bands.fmi - 1); // 0..8 (0 = interior)
  const aStart = sectorIndex * SECTOR_DEG;
  const aEnd = aStart + SECTOR_DEG;
  const rInner = HOLE + ringIndex * BAND;
  const rOuter = rInner + BAND;

  // Marcador en el centroide de la celda del paciente.
  const [mx, my] = polar((rInner + rOuter) / 2, aStart + SECTOR_DEG / 2);

  const ringCircles = Array.from({ length: RINGS + 1 }, (_, k) => HOLE + k * BAND);
  const spokes = Array.from({ length: SECTORS }, (_, j) => j * SECTOR_DEG);

  const label = `Diana EFR: estado ${stateNumber} de 81. Sector funcional ${frSectorName}, fenotipo estructural ${structuralName}.`;

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
        {/* Rejilla: anillos concentricos */}
        {ringCircles.map((r, i) => (
          <circle
            key={`r${i}`}
            cx={C}
            cy={C}
            r={r}
            fill="none"
            className="stroke-border"
            strokeWidth={1}
          />
        ))}
        {/* Rejilla: radios (spokes) que separan los 9 sectores */}
        {spokes.map((deg, j) => {
          const [xi, yi] = polar(HOLE, deg);
          const [xo, yo] = polar(R, deg);
          return (
            <line key={`s${j}`} x1={xi} y1={yi} x2={xo} y2={yo} className="stroke-border" strokeWidth={1} />
          );
        })}
        {/* Celda del paciente resaltada */}
        <path d={segment(rInner, rOuter, aStart, aEnd)} className="fill-primary stroke-primary" fillOpacity={0.85} />
        <circle cx={mx} cy={my} r={4} className="fill-background stroke-primary" strokeWidth={2} />
      </svg>
      <figcaption className="text-center text-xs text-muted-foreground">
        Estado {stateNumber} de 81 · sector {frSectorName} · anillo {structuralName}
      </figcaption>
    </figure>
  );
}
