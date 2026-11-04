// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA MISMA CIUDAD ESCRITA DE TRES FORMAS  ·  2026-11-03
//
// ═══ EL CASO ═══
//
// Santiago, mirando el consolidado por ciudad de /obbia: *"las ciudades duplicadas («Guarne» / «Guarne,
// Antioquia», tres «San Carlos»)"*. En la tabla salian, cada una con su propia fila de una consulta:
//
//     Guarne · Guarne, Antioquia · San Carlos · San Carlos Antioquia · San Carlos Ant
//
// LA CIUDAD ES TEXTO LIBRE que alguien teclea al registrar al paciente, asi que esto no es un defecto del
// panel: es lo que hay en la base. Pero una tabla de caracterizacion que parte una ciudad en tres filas
// de una consulta dice algo falso sobre la cohorte, y ademas fabrica celdas pequeñas (ver
// `supresion-de-celdas`): tres filas de un paciente donde habia una de tres.
//
// ═══ LA REGLA, Y POR QUE ES CONSERVADORA ═══
//
// Lo obvio seria quitar el departamento de la cola ("Antioquia", "Ant", ", Caldas"). Y seria PELIGROSO:
// hay municipios con el mismo nombre en departamentos distintos, asi que recortar a ciegas fundiria dos
// ciudades reales en una, y en un consolidado de investigacion eso es inventar una cohorte.
//
// ASI QUE SOLO SE FUNDE CUANDO LA FORMA CORTA YA EXISTE POR SI SOLA. "Guarne, Antioquia" se funde porque
// en esta misma cohorte hay "Guarne"; "Anserma Caldas" NO se funde, porque no hay ningun "Anserma". La
// evidencia de que son la misma la pone la propia tabla, no una lista de departamentos que habria que
// mantener.
//
// Y LO QUE SI SE NORMALIZA SIEMPRE es lo que no puede significar otra cosa: espacios de mas, mayusculas y
// acentos. "MEDELLIN", "Medellín" y "medellin " son la misma ciudad sin ninguna duda.
//
// ═══ EL NOMBRE QUE SE MUESTRA ES EL MAS COMPLETO DEL GRUPO ═══
//
// Entre "Medellín" y "medellin", gana el que lleva sus acentos. Se elige por numero de consultas y, a
// igualdad, el mas largo: el que mas gente escribio es el que el equipo reconoce.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** La forma comparable de un nombre: sin acentos, sin mayusculas, sin espacios de mas ni puntuacion. */
export function formaComparable(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Una fila de ciudad, con lo minimo para poder agruparla y elegir su nombre. */
export type FilaDeCiudad = {
  grupo: string;
  consultas: number;
  pacientes: number;
  conBis: number;
  conEspectro: number;
  edadMedia: number | null;
};

/**
 * Funde las filas que son la misma ciudad escrita distinto.
 *
 * Dos pasadas, y el orden importa: primero se juntan las que coinciden en su forma comparable (acentos,
 * mayusculas, espacios), y SOLO DESPUES se intenta recortar una cola, contra las formas que ya existen.
 * Al reves, "Guarne, Antioquia" podria recortarse contra una "guarne" que todavia no se habia unificado.
 */
export function ciudadesUnificadas(filas: readonly FilaDeCiudad[]): FilaDeCiudad[] {
  // ── 1. Por forma comparable ──────────────────────────────────────────────────────────────────
  const porForma = new Map<string, FilaDeCiudad[]>();
  for (const f of filas) {
    const k = formaComparable(f.grupo);
    porForma.set(k, [...(porForma.get(k) ?? []), f]);
  }

  // ── 2. Una cola se recorta SOLO si lo que queda ya es un grupo ────────────────────────────────
  const formas = new Set(porForma.keys());
  const destino = new Map<string, string>();
  for (const forma of formas) {
    const palabras = forma.split(" ");
    // Se prueban las colas de UNA y de DOS palabras ("ant", "antioquia", "valle del cauca" no: con dos
    // basta para lo que hay, y cuantas mas se prueben mas probable es fundir dos ciudades distintas).
    for (const cuantas of [1, 2]) {
      if (palabras.length <= cuantas) continue;
      const corta = palabras.slice(0, -cuantas).join(" ");
      if (formas.has(corta) && corta !== forma) {
        destino.set(forma, corta);
        break;
      }
    }
  }

  const grupos = new Map<string, FilaDeCiudad[]>();
  for (const [forma, lista] of porForma) {
    const k = destino.get(forma) ?? forma;
    grupos.set(k, [...(grupos.get(k) ?? []), ...lista]);
  }

  return [...grupos.entries()]
    .map(([clave, lista]) => {
      // ═══ EL NOMBRE QUE SE MUESTRA ES EL DE LA FORMA CANONICA, NO EL MAS LARGO ═══
      //
      // La clave del grupo ES la forma corta, y existe como fila por construccion (esa es la condicion
      // para fundir). Asi que el nombre sale de las filas que coinciden con ella: "San Carlos", no "San
      // Carlos Antioquia".
      //
      // ERA UN DEFECTO REAL Y LO CAZO EL CANDADO: con "mas consultas, y a igualdad el mas largo", las
      // tres filas de una consulta empataban y ganaba la mas larga, o sea la que llevaba el departamento
      // pegado. Se fundia bien y se rotulaba mal.
      //
      // ENTRE LAS QUE SI COINCIDEN con la clave, manda la que mas consultas trae y, a igualdad, la mas
      // larga: ahi "Medellín" le gana a "medellin" porque conserva sus acentos.
      const canonicas = lista.filter((f) => formaComparable(f.grupo) === clave);
      const nombre = [...(canonicas.length > 0 ? canonicas : lista)].sort(
        (a, b) => b.consultas - a.consultas || b.grupo.length - a.grupo.length,
      )[0].grupo;
      const consultas = lista.reduce((n, f) => n + f.consultas, 0);
      // LA EDAD MEDIA SE REPONDERA POR CONSULTAS, no se promedia a secas: promediar medias de grupos de
      // tamaños distintos da un numero que no describe a nadie. Las filas sin edad no entran al peso.
      const conEdad = lista.filter((f) => f.edadMedia != null);
      const pesoConEdad = conEdad.reduce((n, f) => n + f.consultas, 0);
      return {
        grupo: nombre,
        consultas,
        pacientes: lista.reduce((n, f) => n + f.pacientes, 0),
        conBis: lista.reduce((n, f) => n + f.conBis, 0),
        conEspectro: lista.reduce((n, f) => n + f.conEspectro, 0),
        edadMedia:
          pesoConEdad > 0
            ? Math.round(
                (conEdad.reduce((n, f) => n + (f.edadMedia ?? 0) * f.consultas, 0) / pesoConEdad) * 10,
              ) / 10
            : null,
      };
    })
    .sort((a, b) => b.consultas - a.consultas || a.grupo.localeCompare(b.grupo, "es"));
}
