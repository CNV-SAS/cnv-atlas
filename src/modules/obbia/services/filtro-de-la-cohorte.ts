import { formaComparable } from "./ciudades-de-la-cohorte";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL FILTRO DE LA COHORTE  ·  2026-11-04
//
// ═══ DE DONDE SALE, Y POR QUE ERA LA PIEZA QUE DE VERDAD FALTABA ═══
//
// Cotejo de /obbia contra su modulo CNVResearch (2026-11-03). Sus ocho filtros (pais, ciudad, sexo,
// profesional, edad desde/hasta, consulta desde/hasta, solo con bioimpedancia, solo con espectro) son lo
// que convierte el panel en una herramienta: /obbia contestaba *"como es la cohorte"*; con filtros contesta
// *"como es ESTA cohorte"*, que es la pregunta con la que se plantea un analisis.
//
// ═══ VIAJA EN LA URL, Y ESO SE GANA MAS DE LO QUE SE PIERDE ═══
//
// Su modulo filtra en vivo, con JavaScript. Aqui los filtros van en la URL y los manda un
// `<form method="get">`, asi que el panel sigue siendo un Server Component sin una linea de cliente. Se
// pierde el "en vivo" y se gana que una pantalla filtrada SE PUEDA COMPARTIR POR ENLACE, que en
// investigacion vale mas: la cohorte de un analisis se cita, no se describe.
//
// ═══ ESTE MODULO NO SABE SQL, A PROPOSITO ═══
//
// Aqui solo se LEE y se VALIDA lo que viene de la URL, y se describe en palabras. El predicado SQL lo
// arma el lector, en UN solo sitio, y todas sus consultas lo heredan por una CTE. El motivo esta escrito
// alli: si el filtro entra en unas consultas y no en otras, el panel muestra cifras de DOS cohortes
// distintas en la misma pantalla, que es peor que no filtrar.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type FiltroDeCohorte = {
  pais: string | null;
  /** El nombre tal cual se eligio. La comparacion la hace el lector por forma comparable (ver abajo). */
  ciudad: string | null;
  sexo: "M" | "F" | null;
  /** `professional_profiles.id`, no el nombre: dos profesionales pueden llamarse igual. */
  profesional: string | null;
  edadDesde: number | null;
  edadHasta: number | null;
  /** Fecha de la medicion (o de creacion si no hay), en `yyyy-mm-dd`. */
  desde: string | null;
  hasta: string | null;
  soloConBis: boolean;
  soloConEspectro: boolean;
};

export const FILTRO_VACIO: FiltroDeCohorte = {
  pais: null,
  ciudad: null,
  sexo: null,
  profesional: null,
  edadDesde: null,
  edadHasta: null,
  desde: null,
  hasta: null,
  soloConBis: false,
  soloConEspectro: false,
};

/** Los nombres de los campos en la URL. Una sola fuente: los usan el formulario, el lector y el CSV. */
export const CAMPOS_DEL_FILTRO = [
  "pais",
  "ciudad",
  "sexo",
  "profesional",
  "edadDesde",
  "edadHasta",
  "desde",
  "hasta",
  "conBis",
  "conEspectro",
] as const;

export type ParametrosDeUrl = Record<string, string | string[] | undefined>;

function texto(v: string | string[] | undefined): string | null {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lo que viene de la URL, validado.
 *
 * CONSERVADOR EN LAS DOS DIRECCIONES: lo que no se entiende se IGNORA (el filtro queda sin ese eje), no
 * se adivina ni se convierte en un error. Una URL con un valor raro tiene que seguir mostrando la cohorte,
 * porque la alternativa es una pantalla de investigacion caida por un parametro mal pegado.
 *
 * Y LA EDAD SE ORDENA SOLA: `edadDesde=60&edadHasta=20` describe un rango vacio, y lo mas probable es que
 * quien lo escribio invirtiera los dos campos. Se intercambian en vez de devolver cero consultas, que se
 * leeria como "no hay pacientes de esa edad".
 */
export function filtroPedido(sp: ParametrosDeUrl): FiltroDeCohorte {
  const sexoCrudo = texto(sp.sexo)?.toUpperCase();
  const prof = texto(sp.profesional);
  const num = (v: string | string[] | undefined): number | null => {
    const n = Number(texto(v));
    return Number.isFinite(n) && n >= 0 && n <= 120 ? Math.floor(n) : null;
  };
  const fecha = (v: string | string[] | undefined): string | null => {
    const s = texto(v);
    return s && FECHA.test(s) ? s : null;
  };

  let edadDesde = num(sp.edadDesde);
  let edadHasta = num(sp.edadHasta);
  if (edadDesde != null && edadHasta != null && edadDesde > edadHasta) {
    [edadDesde, edadHasta] = [edadHasta, edadDesde];
  }
  let desde = fecha(sp.desde);
  let hasta = fecha(sp.hasta);
  if (desde != null && hasta != null && desde > hasta) {
    [desde, hasta] = [hasta, desde];
  }

  return {
    pais: texto(sp.pais),
    ciudad: texto(sp.ciudad),
    sexo: sexoCrudo === "M" || sexoCrudo === "F" ? sexoCrudo : null,
    profesional: prof && UUID.test(prof) ? prof : null,
    edadDesde,
    edadHasta,
    desde,
    hasta,
    soloConBis: texto(sp.conBis) === "1",
    soloConEspectro: texto(sp.conEspectro) === "1",
  };
}

/** ¿Hay algo filtrado? Decide si la pantalla dice "esta es la cohorte" o "esta es ESTA cohorte". */
export function hayFiltro(f: FiltroDeCohorte): boolean {
  return (
    f.pais != null ||
    f.ciudad != null ||
    f.sexo != null ||
    f.profesional != null ||
    f.edadDesde != null ||
    f.edadHasta != null ||
    f.desde != null ||
    f.hasta != null ||
    f.soloConBis ||
    f.soloConEspectro
  );
}

/**
 * El filtro en palabras, una frase por eje.
 *
 * NO ES DECORACION: es lo que va al ALCANCE del dataset que se descarga. Un archivo de investigacion que
 * dice "resumen de la cohorte" cuando en realidad es "mujeres de 40 a 60 de Medellin" describe otra
 * poblacion, y el registro de la entrega quedaria mintiendo sobre lo que salio.
 */
export function descripcionDelFiltro(
  f: FiltroDeCohorte,
  nombreDelProfesional?: string | null,
): string[] {
  const partes: string[] = [];
  if (f.pais) partes.push(`país: ${f.pais}`);
  if (f.ciudad) partes.push(`ciudad: ${f.ciudad}`);
  if (f.sexo) partes.push(`sexo: ${f.sexo === "M" ? "masculino" : "femenino"}`);
  if (f.profesional) partes.push(`profesional: ${nombreDelProfesional ?? f.profesional}`);
  if (f.edadDesde != null && f.edadHasta != null) partes.push(`edad ${f.edadDesde} a ${f.edadHasta}`);
  else if (f.edadDesde != null) partes.push(`edad desde ${f.edadDesde}`);
  else if (f.edadHasta != null) partes.push(`edad hasta ${f.edadHasta}`);
  if (f.desde && f.hasta) partes.push(`consultas del ${f.desde} al ${f.hasta}`);
  else if (f.desde) partes.push(`consultas desde el ${f.desde}`);
  else if (f.hasta) partes.push(`consultas hasta el ${f.hasta}`);
  if (f.soloConBis) partes.push("solo con bioimpedancia");
  if (f.soloConEspectro) partes.push("solo con espectro Z5-Z500");
  return partes;
}

/**
 * La forma comparable de una ciudad elegida, para que el filtro case con lo que la pantalla MUESTRA.
 *
 * LA TABLA DE CIUDADES FUNDE lo que es la misma ciudad escrita distinto ("Guarne" y "Guarne, Antioquia"),
 * asi que un filtro que comparara el texto crudo devolveria MENOS consultas de las que la fila dice tener,
 * y nadie entenderia por que. El lector compara por esta forma, y ademas acepta lo que empiece por ella
 * mas un espacio, que es la misma regla con la que la tabla funde.
 */
export function formaDeLaCiudadElegida(ciudad: string): string {
  return formaComparable(ciudad);
}
